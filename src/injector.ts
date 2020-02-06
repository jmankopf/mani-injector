import 'reflect-metadata';

export type Class<T = any> = { name: string, new(...args: any[]): T; }

type ProviderFunction = () => unknown;
export type ResolverFunction = (context?: any) => unknown;

export type ID = string | symbol;

export type Dependency = { kind: string; index: number };
type TypeDependency = Dependency & { kind: 'type'; index: number; id: ID; };
type InjectDependency = Dependency & { kind: 'inject'; index: number; id: ID; type: Class; };

const enum TypeMappingKind { CLASS, SINGLETON, VALUE, PROVIDER}

type ClassTypeMapping = { kind: TypeMappingKind.CLASS; type: Class };
type SingletonTypeMapping = { kind: TypeMappingKind.SINGLETON; type: Class; injector: Injector };
type ValueTypeMapping = { kind: TypeMappingKind.VALUE; value: unknown; };
type ProviderTypeMapping = { kind: TypeMappingKind.PROVIDER; provider: ProviderFunction; };
// undefined kind is needed because there is no default mapping for types
type TypeMapping = ClassTypeMapping | SingletonTypeMapping | ValueTypeMapping | ProviderTypeMapping | { kind: undefined };

const enum ClassMappingKind { INSTANCE, VALUE, SINGLETON, PROVIDER}

type InstanceClassMapping = { kind: ClassMappingKind.INSTANCE; };
type ValueClassMapping = { kind: ClassMappingKind.VALUE; value: unknown; };
type SingletonClassMapping = { kind: ClassMappingKind.SINGLETON; injector: Injector };
type ProviderClassMapping = { kind: ClassMappingKind.PROVIDER; provider: ProviderFunction; };
type ClassMapping = InstanceClassMapping | ValueClassMapping | SingletonClassMapping | ProviderClassMapping;

// most of the class mappings are done with the default id, store them in the def field so we eliminate a second map lookup
type MapContainer = { map: Map<ID, ClassMapping>; def?: ClassMapping; };
type SingletonContainer = { map: Map<ID, Object>; def?: Object; };
type ClassResolverContainer = { map: Map<ID, ResolverFunction>; def?: ResolverFunction; };

export type ResolverContext = {
    [propName: string]: any;
    type: Class
    kind: string;
}

const isInjectDependency = (dep: Dependency): dep is InjectDependency => dep.kind === 'inject';
const isTypeDependency = (dep: Dependency): dep is TypeDependency => dep.kind === 'type';

interface ClassMapper<T extends Class> {
    toValue(value: InstanceType<T>): void;
    toSingleton(): void;
    toProvider(provider: () => InstanceType<T>): void;
}

interface TypeMapper<T> {
    toClass<C extends Class<T>>(classValue: C): void;
    toSingleton<C extends Class<T>>(classValue: C): void;
    toValue(value: T): void;
    toProvider(provider: () => T): void;
}

// why is this not in javascript?! ...
export const putIfAbsent = <T extends Map<K, V>, K, V>(map: T, key: K, value: () => V) => {
    let v = map.get(key);
    if (!v) {
        v = value();
        map.set(key, v);
    }
    return v;
};

// helper method to create annotation functions
export const createDependencyAnnotation = (cb: (type: any, index: number, dependantType: Class) => Dependency) => (dependantType: Class, _propertyKey: string | symbol, index: number): any => {
    const metadata = Reflect.getMetadata('design:paramtypes', dependantType);
    const type = metadata[index];
    if (type === dependantType) {
        throw new Error('Could not inject class in itself.');
    }
    const depList = putIfAbsent(Injector.dependencyMap, dependantType, (): Dependency[] => []);
    depList.push(cb(type, index, dependantType));
};

// Default DependencyAnnotations
export const Inject = createDependencyAnnotation((type, index) => ({kind: 'inject', index, type, id: ''}));
export const InjectId = (id: ID) => createDependencyAnnotation((type, index) => ({kind: 'inject', index, type, id}));
export const InjectType = (id: ID) => createDependencyAnnotation((_type, index) => ({kind: 'type', index, id}));

type DependencyExtensionResolver = (context: ResolverContext, dependency: Dependency) => ResolverFunction;

export class Injector {
    static readonly dependencyMap = new Map<Class, Dependency[]>();

    protected readonly typeMappings = new Map<ID, TypeMapping>();
    protected readonly classMappings = new Map<Class, MapContainer>();
    protected readonly parameterResolverArrays = new Map<Class, ResolverFunction[]>();

    protected readonly classResolvers = new Map<Class, ClassResolverContainer>();
    protected readonly typeResolvers = new Map<ID, ResolverFunction>();

    protected readonly singletons = new Map<Class, SingletonContainer>();
    protected readonly typeSingletons = new Map<ID, Object>();

    protected readonly dependencyResolverExtensions: Map<string, DependencyExtensionResolver>;

    constructor(readonly parent?: Injector) {
        this.dependencyResolverExtensions = parent ? parent.dependencyResolverExtensions : new Map<string, DependencyExtensionResolver>();
        this.map(Injector).toValue(this);
    }

    createChild(): this {
        return new (<typeof Injector>this.constructor)(this) as this;
    }

    addExtensionResolver(kind: string, resolver: DependencyExtensionResolver) {
        this.dependencyResolverExtensions.set(kind, resolver);
    }

    map<T extends Class>(type: T, id: ID = ''): ClassMapper<T> {
        const mapper = new InternalClassMapper<T>(this);
        const idMappings = putIfAbsent(this.classMappings, type as Class, (): MapContainer => ({map: new Map<ID, ClassMapping>()}));
        if (id === '') {
            idMappings.def = mapper.mapping;
        } else {
            idMappings.map.set(id, mapper.mapping);
        }
        return mapper;
    }

    mapType<T>(id: ID): TypeMapper<T> {
        const typeMapper = new InternalTypeMapper<T>(this);
        this.typeMappings.set(id, typeMapper.mapping);
        return typeMapper;
    }

    getType<T>(id: ID): T {
        const typeResolver = this.getTypeResolver(id);
        if (!typeResolver) {
            throw new Error(`No Mapping for Type with id: '${String(id)}'`);
        }
        return typeResolver() as T;
    }

    get<T extends Class>(type: T, id: ID = ''): InstanceType<T> {
        const resolver = this.getClassIdResolver(type, id);
        if (!resolver) {
            throw new Error(`No Mapping for Type ${type.name}` + String(id === '' ? '' : ` with id: '${String(id)}'`));
        }
        return resolver() as InstanceType<T>;
    }

    protected createInstance<T extends Class>(type: T) {
        return this.getCreateInstanceResolver(type)();
    }

    protected createResolverArray(resolverContext: ResolverContext) {
        const {type} = resolverContext;
        const result: ResolverFunction[] = [];
        const dependencies = Injector.dependencyMap.get(resolverContext.type);
        if (!dependencies) {
            return [];
        }
        for (const dependency of dependencies) {
            let resolver: ResolverFunction;
            if (isInjectDependency(dependency)) {
                if (!dependency.type) throw new Error(`Undefined dependency type for ${type.name}. Check for circular dependency.`);
                const classIdResolver = this.getClassIdResolver(dependency.type, dependency.id);
                if (!classIdResolver) {
                    throw new Error(`Could not inject ${dependency.type.name} into ${resolverContext.type.name}`);
                }
                resolver = classIdResolver;
            } else if (isTypeDependency(dependency)) {
                const typeResolver = this.getTypeResolver(dependency.id);
                if (!typeResolver) {
                    throw new Error(`Could not inject type with id '${String(dependency.id)}' into ${resolverContext.type.name}`);
                }
                resolver = typeResolver;
            } else {
                const extensionResolver = this.dependencyResolverExtensions.get(dependency.kind);
                if (!extensionResolver) {
                    throw new Error(`no dependency resolver for '${dependency.kind}'`);
                }
                resolver = extensionResolver(resolverContext, dependency);
            }
            result[dependency.index] = resolver;
        }
        return result;
    }

    protected getClassMapping(type: Class, id: ID): ClassMapping | undefined {
        const idMapping = this.classMappings.get(type);
        if (!idMapping) {
            if (!this.parent) return undefined;
            return this.parent.getClassMapping(type, id);
        }
        const mapping = id === '' ? idMapping.def : idMapping.map.get(id);
        if (!mapping) {
            if (!this.parent) return undefined;
            return this.parent.getClassMapping(type, id);
        }
        return mapping;
    }

    protected getClassIdResolver(dependencyType: Class, id: ID) {
        const getResolver = (): ResolverFunction | undefined => {
            const mapping = this.getClassMapping(dependencyType, id);
            if (!mapping) return undefined;
            switch (mapping.kind) {
                case ClassMappingKind.INSTANCE:
                    return this.getCreateInstanceResolver(dependencyType);
                case ClassMappingKind.VALUE:
                    // we can cache the value for values
                    const instance = mapping.value;
                    return () => instance;
                case ClassMappingKind.SINGLETON:
                    let singleton: unknown;
                    // use the injector defined in the mapping to get the right injector
                    const singletonContainer = putIfAbsent(mapping.injector.singletons, dependencyType, (): SingletonContainer => ({map: new Map<ID, Object>()}));
                    if (id === '') {
                        if (singletonContainer.def) {
                            singleton = singletonContainer.def;
                        } else {
                            singletonContainer.def = mapping.injector.createInstance(dependencyType);
                            singleton = singletonContainer.def;
                        }
                    } else {
                        singleton = putIfAbsent(singletonContainer.map, id, () => mapping.injector.createInstance(dependencyType));
                    }
                    return () => singleton;
                case ClassMappingKind.PROVIDER:
                    // we can directly set the provider function as resolver
                    return mapping.provider;
            }
        };

        const container = putIfAbsent(this.classResolvers, dependencyType, (): ClassResolverContainer => ({
            def: undefined,
            map: new Map<ID, ResolverFunction>(),
        }));

        if (id === '') {
            if (container.def) {
                return container.def;
            }
            const resolver = getResolver();
            container.def = resolver;
            return resolver;
        } else {
            return putIfAbsent(container.map, id, () => getResolver());
        }
    }

    protected getTypeResolver(id: ID): ResolverFunction | undefined {
        return putIfAbsent(this.typeResolvers, id, () => {
            const mapping = this.getTypeMapping(id);
            if (!mapping) return undefined;
            if (mapping.kind === undefined) {
                // mapping.kind is undefined if there is a  type mapping without a target (toClass, toSingleton, toValue)
                throw new Error(`No TypeMapping for id ${String(id)}.`);
            }
            if (mapping.kind === TypeMappingKind.VALUE) {
                const instance = mapping.value;
                return () => instance;
            } else if (mapping.kind === TypeMappingKind.CLASS) {
                return this.getCreateInstanceResolver(mapping.type);
            } else if (mapping.kind === TypeMappingKind.SINGLETON) {
                // use the injector defined in the mapping to get the right injector
                const instance = putIfAbsent(mapping.injector.typeSingletons, id, () => mapping.injector.createInstance(mapping.type));
                return () => instance;
            } else {
                // mapping kind has to be provider
                return mapping.provider;
            }
        });
    }

    protected getCreateInstanceResolver(type: Class) {
        const resolvers = putIfAbsent(this.parameterResolverArrays, type as Class, () => this.createResolverArray({
            kind: 'class',
            type: type,
        }));
        if (resolvers.length === 0) {
            return () => new type();
        }
        const args = new Array(resolvers.length);
        return () => {
            for (let i = 0; i < args.length; i++) {
                args[i] = resolvers[i]();
            }
            return new type(...args);
        };
    }

    protected getTypeMapping(id: ID): TypeMapping | undefined {
        const mapping = this.typeMappings.get(id);
        if (!mapping) {
            if (!this.parent) return undefined;
            return this.parent.getTypeMapping(id);
        }
        return mapping;
    }
}

class InternalTypeMapper<T> implements TypeMapper<T> {
    mapping: TypeMapping = {kind: undefined};

    constructor(private readonly injector: Injector) {
    }

    toClass<C extends Class<T>>(classValue: C): void {
        Object.assign<TypeMapping, ClassTypeMapping>(this.mapping, {
            kind: TypeMappingKind.CLASS,
            type: classValue,
        });
    }

    toSingleton<C extends Class<T>>(classValue: C): void {
        Object.assign<TypeMapping, SingletonTypeMapping>(this.mapping, {
            kind: TypeMappingKind.SINGLETON,
            type: classValue,
            injector: this.injector,
        });
    }

    toValue(value: T): void {
        Object.assign<TypeMapping, ValueTypeMapping>(this.mapping, {
            kind: TypeMappingKind.VALUE,
            value: value,
        });
    }

    toProvider(provider: () => T): void {
        Object.assign<TypeMapping, ProviderTypeMapping>(this.mapping, {
            kind: TypeMappingKind.PROVIDER,
            provider: provider,
        });
    }
}

class InternalClassMapper<T extends Class> implements ClassMapper<T> {
    // instance is the default class mapping
    mapping: ClassMapping = {kind: ClassMappingKind.INSTANCE};

    constructor(private readonly injector: Injector) {}

    toValue(value: InstanceType<T>) {
        Object.assign<ClassMapping, ValueClassMapping>(this.mapping, {
            kind: ClassMappingKind.VALUE,
            value: value,
        });
    }

    toSingleton(): void {
        Object.assign<ClassMapping, SingletonClassMapping>(this.mapping, {
            kind: ClassMappingKind.SINGLETON,
            injector: this.injector,
        });
        this.mapping.kind = ClassMappingKind.SINGLETON;
    }

    toProvider(provider: () => InstanceType<T>): void {
        Object.assign<ClassMapping, ProviderClassMapping>(this.mapping, {
            kind: ClassMappingKind.PROVIDER,
            provider: provider,
        });
    }
}
