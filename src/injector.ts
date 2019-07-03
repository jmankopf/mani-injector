import 'reflect-metadata';

type Class<T = any> = { name: string, new(...args: any[]): T; }
type ComponentClass = Class;
type EntityClass = Class;

type ProviderFunction = () => unknown;
type ResolverFunction = (context?: any) => unknown;

type ID = string | symbol;

const enum DependencyKind { INJECT, TYPE, COMPONENT, ENTITY}

type InjectDependency = { kind: DependencyKind.INJECT; index: number; id: ID; type: Class; };
type TypeDependency = { kind: DependencyKind.TYPE; index: number; id: ID; };
type ComponentDependency = { kind: DependencyKind.COMPONENT; index: number; type: Class; };
type EntityDependency = { kind: DependencyKind.ENTITY; index: number };
type Dependency = InjectDependency | TypeDependency | ComponentDependency | EntityDependency;

const enum TypeMappingKind { CLASS, SINGLETON, VALUE, PROVIDER}

type ClassTypeMapping = { kind: TypeMappingKind.CLASS; type: Class };
type SingletonTypeMapping = { kind: TypeMappingKind.SINGLETON; type: Class; injector: Injector };
type ValueTypeMapping = { kind: TypeMappingKind.VALUE; value: unknown; };
type ProviderTypeMapping = { kind: TypeMappingKind.PROVIDER; provider: ProviderFunction; };
// undefined kind is needed because there is no default mapping for types
type TypeMapping = ClassTypeMapping | SingletonTypeMapping | ValueTypeMapping | ProviderTypeMapping | { kind: undefined };

const enum MappingKind { INSTANCE, VALUE, SINGLETON, PROVIDER}

type InstanceClassMapping = { kind: MappingKind.INSTANCE; };
type ValueClassMapping = { kind: MappingKind.VALUE; value: unknown; };
type SingletonClassMapping = { kind: MappingKind.SINGLETON; injector: Injector };
type ProviderClassMapping = { kind: MappingKind.PROVIDER; provider: ProviderFunction; };
type ClassMapping = InstanceClassMapping | ValueClassMapping | SingletonClassMapping | ProviderClassMapping;

// most of the class mappings are done with the default id, store them in the def field so we eliminate a second map lookup
type MapContainer = { map: Map<ID, ClassMapping>; def?: ClassMapping; };
type SingletonContainer = { map: Map<ID, Object>; def?: Object; };
type ClassResolverContainer = { map: Map<ID, ResolverFunction>; def?: ResolverFunction; };

type EntityResolverContext = { kind: 'entity', entityClass: Object; };
type ResolverContext = EntityResolverContext | undefined;

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

const putIfAbsent = <T extends Map<K, V>, K, V>(map: T, key: K, value: () => V) => {
    let v = map.get(key);
    if (!v) {
        v = value();
        map.set(key, v);
    }
    return v;
};

// the annotations store dependencies in this map, so it has to be module scoped
const dependencyMap = new Map<Class, Dependency[]>();
// entity component annotations store their key names in this map needs to be module scoped
export const entityComponents = new Map<EntityClass, Map<ComponentClass, string>>();

// helper method to create annotation functions
const createDependencyAnnotation = (cb: (type: any, index: number, dependantType: Class) => Dependency) => (dependantType: Class, _propertyKey: string | symbol, index: number): any => {
    const metadata = Reflect.getMetadata('design:paramtypes', dependantType);
    const type = metadata[index];
    if (type === dependantType) {
        throw new Error('Could not inject class in itself.');
    }
    const depList = putIfAbsent(dependencyMap, dependantType, (): Dependency[] => []);
    depList.push(cb(type, index, dependantType));
};

const getComponentDependencies = (system: Class) => {
    const dependencies = dependencyMap.get(system);
    return dependencies
        ? dependencies.filter((dependency): dependency is ComponentDependency => dependency.kind === DependencyKind.COMPONENT)
        : [];
};

const getEntityClassesForComponentDependencies = (componentTypes: Class[]): Class[] => {
    // TODO: refactor class, use map, filter etc...
    const result = [];
    for (const [entityClass, componentMap] of entityComponents) {
        let allDependenciesMet = true;
        for (const componentType of componentTypes) {
            if (!componentMap.has(componentType)) {
                allDependenciesMet = false;
                break;
            }
        }
        if (allDependenciesMet) {
            result.push(entityClass);
        }
    }
    return result;
};

export const Inject = createDependencyAnnotation((type, index) => ({kind: DependencyKind.INJECT, index, type, id: ''}));
export const InjectId = (id: ID) => createDependencyAnnotation((type, index) => ({kind: DependencyKind.INJECT, index, type, id}));
export const InjectType = (id: ID) => createDependencyAnnotation((_type, index) => ({kind: DependencyKind.TYPE, index, id}));
export const GetComponent = createDependencyAnnotation((type, index) => ({kind: DependencyKind.COMPONENT, type, index}));
export const GetEntity = createDependencyAnnotation((_type, index) => ({kind: DependencyKind.ENTITY, index}));
export const EntityComponent = (target: object, propertyKey: string): any => {
    const entityClass = target.constructor;
    const componentClass = Reflect.getMetadata('design:type', target, propertyKey);
    if (componentClass === Object) {
        throw new Error(`Object component type not allowed. Forgot to specify type of ${entityClass.name}.${propertyKey}?`);
    }
    const componentSet = putIfAbsent(entityComponents, entityClass, () => new Map<ComponentClass, string>());
    componentSet.set(componentClass, propertyKey);
};

type SystemResolvers<T extends Class> = [T, ResolverFunction[]]

export class Injector<SystemClass extends Class = Class> {
    static readonly dependencyMap = dependencyMap;

    protected readonly typeMappings = new Map<ID, TypeMapping>();
    protected readonly classMappings = new Map<Class, MapContainer>();
    protected readonly resolverArrays = new Map<Class, ResolverFunction[]>();

    protected readonly classResolvers = new Map<Class, ClassResolverContainer>();
    protected readonly typeResolvers = new Map<ID, ResolverFunction>();

    protected readonly singletons = new Map<Class, SingletonContainer>();
    protected readonly typeSingletons = new Map<ID, Object>();

    protected readonly entitySystemMap = new Map<EntityClass, SystemClass[]>();
    protected readonly entitySystemResolverTuples = new Map<EntityClass, SystemResolvers<SystemClass>[]>();

    constructor(readonly parent?: Injector) {
        this.map(Injector).toValue(this);
    }

    createChild(): this {
        return new (<typeof Injector>this.constructor)(this) as this;
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
        return this.getTypeResolver(id)() as T;
    }

    get<T extends Class>(type: T, id: ID = ''): InstanceType<T> {
        return this.getClassIdResolver(type, id)() as InstanceType<T>;
    }

    registerSystem<T extends SystemClass>(systemClass: T) {
        // TODO: check if system is already mapped
        const componentDependencies = getComponentDependencies(systemClass).map(dependency => dependency.type);
        const entityClasses = getEntityClassesForComponentDependencies(componentDependencies);
        if (entityClasses.length === 0) {
            console.warn(`System '${systemClass.name}' has no matching entities.`);
            return;
        }
        for (let entityClass of entityClasses) {
            const systemClasses = putIfAbsent(this.entitySystemMap, entityClass, (): SystemClass[] => []);
            systemClasses.push(systemClass);
        }
    }

    createSystems(entity: Object): InstanceType<SystemClass>[] {
        const systemResolverTuples = putIfAbsent(this.entitySystemResolverTuples, entity.constructor, (): SystemResolvers<SystemClass>[] => {
            const systems = this.entitySystemMap.get(entity.constructor as Class);
            if (!systems) {
                console.warn('no system for entity ' + entity.constructor.name);
                return [];
            }

            const result: SystemResolvers<SystemClass>[] = [];
            for (const system of systems!) {
                result.push([system, this.createResolverArray(system, {kind: 'entity', entityClass: entity.constructor})]);
            }
            return result;
        });
        const systemInstances = [];
        for (const [system, resolver] of systemResolverTuples) {
            const args = new Array(resolver.length);
            for (let i = 0; i < args.length; i++) {
                args[i] = resolver[i](entity);
            }
            systemInstances.push(new system(...args));
        }
        return systemInstances;
    }

    private createInstance<T extends Class>(type: T) {
        return this.getCreateInstanceResolver(type)();
    }

    private createResolverArray(type: Class, resolverContext?: ResolverContext) {
        const result: ResolverFunction[] = [];
        const dependencies = dependencyMap.get(type);
        if (!dependencies) {
            return [];
        }
        for (const dependency of dependencies) {
            let resolver: ResolverFunction;
            if (dependency.kind === DependencyKind.INJECT) {
                if (!dependency.type) throw new Error(`Undefined dependency type for ${type.name}. Check for circular dependency.`);
                resolver = this.getClassIdResolver(dependency.type, dependency.id);
            } else if (dependency.kind === DependencyKind.TYPE) {
                resolver = this.getTypeResolver(dependency.id);
            } else if (dependency.kind === DependencyKind.ENTITY) {
                if (!resolverContext || resolverContext.kind !== 'entity') {
                    throw new Error(`Could not resolve Entity in ${type.name}. @GetEntity only allowed in entity scope.`);
                }
                resolver = (entity: any) => entity;
            } else if (dependency.kind === DependencyKind.COMPONENT) {
                if (!resolverContext || resolverContext.kind !== 'entity') {
                    throw new Error(`Could not resolve ${dependency.type.name} in ${type.name}. @GetComponent only allowed in entity scope.`);
                }
                const entityClass = resolverContext.entityClass;
                const key = entityComponents.get(<any>entityClass as Class)!.get(dependency.type);
                resolver = (entity: any) => entity[key!];
            } else {
                console.warn('could not resolve');
                resolver = () => undefined;
            }
            result[dependency.index] = resolver;
        }
        return result;
    }

    private getClassMapping(type: Class, id: ID): ClassMapping {
        const idMapping = this.classMappings.get(type);
        if (!idMapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name}`);
            }
            return this.parent.getClassMapping(type, id);
        }
        const mapping = id === '' ? idMapping.def : idMapping.map.get(id);
        if (!mapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name} with id: '${String(id)}'`);
            }
            return this.parent.getClassMapping(type, id);
        }
        return mapping;
    }

    private getClassIdResolver(dependencyType: Class, id: ID) {
        // TODO create a class/helper like putIfAbsent for nested maps / multiple keys
        const getResolver = (): ResolverFunction => {
            const mapping = this.getClassMapping(dependencyType, id);
            switch (mapping.kind) {
                case MappingKind.INSTANCE:
                    return this.getCreateInstanceResolver(dependencyType);
                // return () => this.createInstance(dependencyType);
                case MappingKind.VALUE:
                    // we can cache the value for values
                    const instance = mapping.value;
                    return () => instance;
                case MappingKind.SINGLETON:
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
                case MappingKind.PROVIDER:
                    // we can directly set the provider function as resolver
                    return mapping.provider;
            }
        };

        const container = putIfAbsent(this.classResolvers, dependencyType, (): ClassResolverContainer => ({
            def: undefined,
            map: new Map<ID, ResolverFunction>()
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

    private getTypeResolver(id: ID): ResolverFunction {
        return putIfAbsent(this.typeResolvers, id, () => {
            const mapping = this.getTypeMapping(id);
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

    private getCreateInstanceResolver(type: Class) {
        const resolvers = putIfAbsent(this.resolverArrays, type as Class, () => this.createResolverArray(type));
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

    private getTypeMapping(id: ID): TypeMapping {
        const mapping = this.typeMappings.get(id);
        if (!mapping) {
            if (!this.parent) throw new Error(`No TypeMapping for id ${String(id)}`);
            return this.parent.getTypeMapping(id);
        }
        return mapping;
    }

    dispose() {
        for (let key in this) if (this.hasOwnProperty(key)) delete this[key];
    }
}

class InternalTypeMapper<T> implements TypeMapper<T> {
    mapping: TypeMapping = {kind: undefined};

    constructor(private readonly injector: Injector) {
    }

    toClass<C extends Class<T>>(classValue: C): void {
        Object.assign<TypeMapping, ClassTypeMapping>(this.mapping, {
            kind: TypeMappingKind.CLASS,
            type: classValue
        });
    }

    toSingleton<C extends Class<T>>(classValue: C): void {
        Object.assign<TypeMapping, SingletonTypeMapping>(this.mapping, {
            kind: TypeMappingKind.SINGLETON,
            type: classValue,
            injector:this.injector
        });
    }

    toValue(value: T): void {
        Object.assign<TypeMapping, ValueTypeMapping>(this.mapping, {
            kind: TypeMappingKind.VALUE,
            value: value
        });
    }

    toProvider(provider: () => T): void {
        Object.assign<TypeMapping, ProviderTypeMapping>(this.mapping, {
            kind: TypeMappingKind.PROVIDER,
            provider: provider
        });
    }

}

class InternalClassMapper<T extends Class> implements ClassMapper<T> {
    // instance is the default class mapping
    mapping: ClassMapping = {kind: MappingKind.INSTANCE};

    constructor(private readonly injector: Injector) {
    }

    toValue(value: InstanceType<T>) {
        Object.assign<ClassMapping, ValueClassMapping>(this.mapping, {
            kind: MappingKind.VALUE,
            value: value
        });
    }

    toSingleton(): void {
        Object.assign<ClassMapping, SingletonClassMapping>(this.mapping, {
            kind: MappingKind.SINGLETON,
            injector: this.injector
        });
        this.mapping.kind = MappingKind.SINGLETON;
    }

    toProvider(provider: () => InstanceType<T>): void {
        Object.assign<ClassMapping, ProviderClassMapping>(this.mapping, {
            kind: MappingKind.PROVIDER,
            provider: provider
        });
    }
}
