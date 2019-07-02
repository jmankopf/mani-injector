import 'reflect-metadata';

type Class<T = any> = { new(...args: any[]): T; }
type ComponentClass = Class;
type EntityClass = Class;

type FirstParameter<T extends Class> = ConstructorParameters<T>[0];

type ProviderFunction = () => unknown;
type ResolverFunction = (context?: any) => unknown;

type ID = string | symbol;

type InjectDependency = { kind: 'inject'; index: number; id: ID; type: Class; };
type ParameterDependency = { kind: 'parameter'; index: number; };
type TypeDependency = { kind: 'type'; index: number; id: ID; };
type ComponentDependency = { kind: 'component'; index: number; type: Class; };
type EntityDependency = { kind: 'entity'; index: number };
type Dependency = InjectDependency | ParameterDependency | TypeDependency | ComponentDependency | EntityDependency;

type ClassTypeMapping = { kind: 'class'; id: ID; type: Class; };
type ValueTypeMapping = { kind: 'value'; value: unknown; };
type ProviderTypeMapping = { kind: 'provider'; provider: ProviderFunction; };
type TypeMapping = ClassTypeMapping | ValueTypeMapping | ProviderTypeMapping | { kind: undefined };
// undefined kind is needed because there is no default mapping for types

type InstanceClassMapping = { kind: 'instance'; };
type ValueClassMapping = { kind: 'value'; value: unknown; };
type SingletonClassMapping = { kind: 'singleton'; };
type ProviderClassMapping = { kind: 'provider'; provider: ProviderFunction; };
type ClassMapping = InstanceClassMapping | ValueClassMapping | SingletonClassMapping | ProviderClassMapping;

// most of the mappings are with the default id, store them in the def field so we eliminate a second map lookup
type MapContainer = { map: Map<ID, ClassMapping>; def?: ClassMapping; };
type SingletonContainer = { map: Map<ID, Object>; def?: Object; };

type EntityResolverContext = { kind: 'entity', entityClass: Object; };
type ResolverContext = EntityResolverContext | undefined;

interface ClassMapper<T extends Class> {
    toValue(value: InstanceType<T>): void;
    toSingleton(): void;
    toProvider(provider: () => InstanceType<T>): void;
}

interface TypeMapper<T> {
    toClass<C extends Class<T>>(classValue: C, params?: FirstParameter<C>): void;
    toClassId<C extends Class<T>>(classValue: C, id: ID, param?: FirstParameter<C>): void;
    toMapClass<C extends Class<T>>(classValue: C, param?: FirstParameter<C>): ClassMapper<C>;
    toMapClassId<C extends Class<T>>(classValue: C, id: ID, param?: FirstParameter<C>): ClassMapper<C>;
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

const hasParameterAnnotation = (type: Class) => {
    const dependency = dependencyMap.get(type);
    return dependency && dependency.filter(v => v.kind === 'parameter').length > 0;
};

const getComponentDependencies = (system: Class) => {
    const dependencies = dependencyMap.get(system);
    return dependencies
        ? dependencies.filter((dependency): dependency is ComponentDependency => dependency.kind === 'component')
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

export const Inject = createDependencyAnnotation((type, index) => ({kind: 'inject', index, type, id: ''}));
export const InjectId = (id: ID) => createDependencyAnnotation((type, index) => ({kind: 'inject', index, type, id}));
export const InjectType = (id: ID) => createDependencyAnnotation((_type, index) => ({kind: 'type', index, id}));
export const Parameter = createDependencyAnnotation((_type, index, dependantType) => {
    if (index !== 0) {
        throw new Error(`Error mapping ${dependantType.name}. Parameter dependency needs to be the first argument`);
    }
    return {kind: 'parameter', index};
});
export const GetComponent = createDependencyAnnotation((type, index) => ({kind: 'component', type, index}));
export const GetEntity = createDependencyAnnotation((_type, index) => ({kind: 'entity', index}));
export const EntityComponent = (target: object, propertyKey: string): any => {
    const entityClass = target.constructor;
    const componentClass = Reflect.getMetadata('design:type', target, propertyKey);
    if (componentClass === Object) {
        throw new Error(`Object component type not allowed. Forgot to specify type of ${entityClass.name}.${propertyKey}?`);
    }
    const componentSet = putIfAbsent(entityComponents, entityClass, () => new Map<ComponentClass, string>());
    componentSet.set(componentClass, propertyKey);
};

type SystemResolvers<T extends Class> = [
    T,
    ResolverFunction[]
    ]

export class Injector<SystemClass extends Class = Class> {
    static readonly dependencyMap = dependencyMap;

    protected readonly typeMappings = new Map<ID, TypeMapping>();
    protected readonly classMappings = new Map<Class, MapContainer>();
    protected readonly resolvers = new Map<Class, ResolverFunction[]>();
    protected readonly params = new Map<Class, unknown>();
    protected readonly singletons = new Map<Class, SingletonContainer>();
    protected readonly entitySystemMap = new Map<EntityClass, SystemClass[]>();
    protected readonly entitySystemResolverTuples = new Map<EntityClass, SystemResolvers<SystemClass>[]>();

    constructor(readonly parent?: Injector) {
        this.map(Injector).toValue(this);
    }

    createChild(): this {
        return new (<typeof Injector>this.constructor)(this) as this;
    }

    map<T extends Class>(type: T, param?: FirstParameter<T>): ClassMapper<T> {
        return this.mapId<T>(type, '', param);
    }

    mapId<T extends Class>(type: T, id: ID, param?: FirstParameter<T>): ClassMapper<T> {
        this.storeParams(type, param);

        const mapper = new InternalClassMapper<T>(type);
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
        const mapping = this.typeMappings.get(id);
        if (!mapping || !mapping.kind) {
            if (!this.parent) {
                throw new Error(`No TypeMapping for id ${String(id)}`);
            }
            return this.parent.getType<T>(id);
        }
        if (mapping.kind === 'value') {
            return mapping.value as T;
        } else if (mapping.kind === 'class') {
            return this.get(mapping.type, mapping.id);
        } else {
            // has to be provider
            return mapping.provider() as T;
        }
    }

    get<T extends Class>(type: T, id: ID = ''): InstanceType<T> {
        const idMapping = this.classMappings.get(type);
        if (!idMapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name}`);
            }
            return this.parent.get(type, id);
        }
        const mapping = id === '' ? idMapping.def : idMapping.map.get(id);
        if (!mapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name} with id: '${String(id)}'`);
            }
            return this.parent.get(type, id);
        }
        if (mapping.kind === 'singleton') {
            const singletonIds = putIfAbsent(this.singletons, type as Class, (): SingletonContainer => ({map: new Map<ID, Object>()}));
            if (id === '') {
                if (!singletonIds.def) {
                    return singletonIds.def = this.createInstance(type);
                }
                return singletonIds.def as InstanceType<T>;
            } else
                return putIfAbsent(singletonIds.map, id, () => this.createInstance(type));
        }
        if (mapping.kind === 'value') {
            return mapping.value as InstanceType<T>;
        }
        if (mapping.kind === 'provider') {
            return mapping.provider() as InstanceType<T>;
        }

        return this.createInstance(type);
    }

    registerSystem<T extends SystemClass>(systemClass: T, param?: FirstParameter<T>) {
        // TODO: check if system is already mapped
        this.storeParams(systemClass, param);
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
                result.push([system, this.createResolver(system, {kind: 'entity', entityClass: entity.constructor})]);
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
        const resolvers = putIfAbsent(this.resolvers, type as Class, () => this.createResolver(type));
        if (resolvers.length == 0) {
            return new type();
        }
        const args = new Array(resolvers.length);

        for (let i = 0; i < args.length; i++) {
            args[i] = resolvers[i]();
        }
        return new type(...args);
    }

    private createResolver(type: Class, resolverContext?: ResolverContext) {
        const result: ResolverFunction[] = [];
        const dependencies = dependencyMap.get(type);
        if (!dependencies) {
            return [];
        }
        for (const dependency of dependencies) {
            let resolver: ResolverFunction;
            if (dependency.kind === 'inject') {
                if (!dependency.type) throw new Error(`Undefined dependency type for ${type.name}. Check for circular dependency.`);
                resolver = this.createInjectResolver(dependency.type, dependency.id);
            } else if (dependency.kind === 'type') {
                resolver = this.createTypeResolver(type, dependency);
            } else if (dependency.kind === 'parameter') {
                const param = this.params.get(type);
                resolver = () => param;
            } else if (dependency.kind === 'entity') {
                if (!resolverContext || resolverContext.kind !== 'entity') {
                    throw new Error(`Could not resolve Entity in ${type.name}. @GetEntity only allowed in entity scope.`);
                }
                resolver = (entity: any) => entity;
            } else if (dependency.kind === 'component') {
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

    private getMapping(type: Class, id: ID): ClassMapping {
        const idMapping = this.classMappings.get(type);
        if (!idMapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name}`);
            }
            return this.parent.getMapping(type, id);
        }
        const mapping = id === '' ? idMapping.def : idMapping.map.get(id);
        if (!mapping) {
            if (!this.parent) {
                throw new Error(`No Mapping for Type ${type.name} with id: '${String(id)}'`);
            }
            return this.parent.getMapping(type, id);
        }
        return mapping;
    }

    private createInjectResolver(dependencyType: Class, id: ID) {
        const mapping = this.getMapping(dependencyType, id);
        switch (mapping.kind) {
            case 'instance':
                return () => this.get(dependencyType, id);
            case 'singleton':
            case 'value':
                // we can cache the value for single instances
                const instance = this.get(dependencyType, id);
                return () => instance;
            case 'provider':
                // we can directly set the provider function as resolver
                return mapping.provider;
        }
    }

    private createTypeResolver(type: Class, dependency: TypeDependency): ResolverFunction {
        const mapping = this.typeMappings.get(dependency.id);
        if (!mapping || !mapping.kind) {
            if (!this.parent) {
                throw new Error(`No TypeMapping for id ${String(dependency.id)}`);
            }
            return this.parent.createTypeResolver(type, dependency);
        }
        if (mapping.kind === 'value') {
            const instance = mapping.value;
            return () => instance;
        } else if (mapping.kind === 'class') {
            return this.createInjectResolver(mapping.type, mapping.id);
        } else {
            // mapping kind has to be provider
            return mapping.provider;
        }
    }

    private storeParams(classType: Class, param: unknown, _id: ID = '') {
        // TODO: store param by id so u could have different params per type
        if (hasParameterAnnotation(classType)) {
            if (!param) throw new Error(`Type ${classType.name} has a Parameter dependency but no parameters are provided`);
            this.params.set(classType, param);
        } else {
            if (param) throw new Error(`Type ${classType.name} has unused parameters provided`);
        }
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
        this.toClassId(classValue, '');
    }

    toClassId<C extends Class<T>>(classValue: C, id: ID): void {
        Object.assign<TypeMapping, ClassTypeMapping>(this.mapping, {
            kind: 'class',
            id: id,
            type: classValue
        });
    }

    toMapClass<C extends Class<T>>(classValue: C, param?: FirstParameter<C>): ClassMapper<C> {
        return this.toMapClassId(classValue, '', param);
    }

    toMapClassId<C extends Class<T>>(classValue: C, id: ID, param?: FirstParameter<C>): ClassMapper<C> {
        Object.assign<TypeMapping, ClassTypeMapping>(this.mapping, {
            kind: 'class',
            id: id,
            type: classValue
        });
        return this.injector.mapId(classValue, id, param);
    }

    toValue(value: T): void {
        Object.assign<TypeMapping, ValueTypeMapping>(this.mapping, {
            kind: 'value',
            value: value
        });
    }

    toProvider(provider: () => T): void {
        Object.assign<TypeMapping, ProviderTypeMapping>(this.mapping, {
            kind: 'provider',
            provider: provider
        });
    }
}

class InternalClassMapper<T extends Class> implements ClassMapper<T> {
    // instance is the default class mapping
    mapping: ClassMapping = {kind: 'instance'};

    constructor(readonly type: Class) {
    }

    toValue(value: InstanceType<T>) {
        Object.assign<ClassMapping, ValueClassMapping>(this.mapping, {
            kind: 'value',
            value: value
        });
    }

    toSingleton(): void {
        this.mapping.kind = 'singleton';
    }

    toProvider(provider: () => InstanceType<T>): void {
        Object.assign<ClassMapping, ProviderClassMapping>(this.mapping, {
            kind: 'provider',
            provider: provider
        });
    }
}
