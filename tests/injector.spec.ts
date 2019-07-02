import {Injector} from '../src/injector';
import {
    CircularA,
    DependantA,
    DependencyA,
    Primitives,
    SimpleA,
    SimpleB,
    SimpleC,
    SimpleId,
    SimpleParam,
    SimpleSymbol,
    SimpleType,
    SimpleTypeImpl,
    SimpleTypeImplB,
    SimpleTypeUser,
    symbol1,
    symbol2,
} from './simpleClasses';
import {CircularB} from './circularB';

describe('Injector tests', () => {
    it('dependencies of annotated classes should have been added', () => {
        const deps = Injector.dependencyMap.get(DependantA);
        if (!deps) throw new Error();
        expect(deps.length).toBe(4);
    });

    it('should map to multiple instances', () => {
        const injector = new Injector();
        injector.map(DependencyA);
        const instance1 = injector.get(DependencyA);
        const instance2 = injector.get(DependencyA);
        expect(instance1 instanceof DependencyA).toBeTruthy();
        expect(instance2 instanceof DependencyA).toBeTruthy();
        expect(instance1).not.toBe(instance2);
    });

    it('should map to value', () => {
        const injector = new Injector();
        const dependencyA1 = new DependencyA();
        const dependencyA2 = new DependencyA();
        injector.map(DependencyA).toValue(dependencyA1);
        injector.mapId(DependencyA, 'id').toValue(dependencyA2);
        expect(injector.get(DependencyA)).toBe(dependencyA1);
        expect(injector.get(DependencyA, 'id')).toBe(dependencyA2);
    });

    it('should map to singleton', () => {
        const injector = new Injector();
        injector.map(DependencyA).toSingleton();
        injector.mapId(DependencyA, 'id').toSingleton();
        const instance1 = injector.get(DependencyA);
        const instance2 = injector.get(DependencyA);
        const instance3 = injector.get(DependencyA, 'id');

        expect(instance1).toBe(instance2);
        expect(instance1).not.toBe(instance3);
        expect(instance1 instanceof DependencyA).toBeTruthy();
        expect(instance3 instanceof DependencyA).toBeTruthy();
    });

    it('Injector should have mapped Injector to itself', () => {
        const injector = new Injector();
        expect(injector.get(Injector)).toBe(injector);
        const childInjector = injector.createChild();
        expect(childInjector.get(Injector)).toBe(childInjector);
        expect(injector).not.toBe(childInjector);
    });

    it('should inject multiple classes', () => {
        const injector = new Injector();

        const simpleA = new SimpleA();
        injector.map(SimpleA).toValue(simpleA);
        injector.map(SimpleB).toSingleton();
        injector.map(SimpleC).toSingleton();

        const a = injector.get(SimpleA);
        const b = injector.get(SimpleB);
        const c = injector.get(SimpleC);

        expect(a instanceof SimpleA).toBeTruthy();
        expect(b instanceof SimpleB).toBeTruthy();

        expect(a).toBe(simpleA);
        expect(b.a).toBe(a);
        expect(c.a).toBe(a);
        expect(c.b).toBe(b);

    });

    it('should map by id', () => {
        const injector = new Injector();
        const simpleA = new SimpleA();
        injector.mapId(SimpleA, 'one').toValue(simpleA);
        injector.mapId(SimpleA, 'two').toSingleton();
        injector.map(SimpleId).toSingleton();

        const simpleId = injector.get(SimpleId);
        expect(simpleId.a1).toBe(simpleA);
        expect(simpleId.a2).toBe(injector.get(SimpleA, 'two'));
    });

    it('map to provider', () => {
        const injector = new Injector();

        let count = 0;
        injector.map(SimpleA).toProvider(() => {
            count++;
            return new SimpleA();
        });
        injector.map(SimpleB);

        const b1 = injector.get(SimpleB);
        const b2 = injector.get(SimpleB);
        const a = injector.get(SimpleA);

        expect(a instanceof SimpleA).toBeTruthy();
        expect(b1.a instanceof SimpleA).toBeTruthy();
        expect(b2.a instanceof SimpleA).toBeTruthy();
        expect(count).toBe(3);
    });

    it('should map type to a value', () => {
        const injector = new Injector();
        const st: SimpleType = {value: 'test'};
        injector.mapType<SimpleType>(symbol1).toValue(st);
        injector.map(SimpleTypeUser);
        expect(injector.getType(symbol1)).toBe(st);
        expect(injector.get(SimpleTypeUser).simpleType).toBe(st);
    });

    it('should map type to a provider', () => {
        const injector = new Injector();
        let count = 0;
        const provider = () => ({value: 'testvalue' + (count++)});
        injector.mapType<SimpleType>(symbol1).toProvider(provider);
        injector.map(SimpleTypeUser);
        const simpleType = injector.getType<SimpleType>(symbol1);
        const simpleTypeUser = injector.get(SimpleTypeUser);
        expect(simpleType.value).toBe('testvalue0');
        expect(simpleTypeUser.simpleType.value).toBe('testvalue1');
    });

    it('should map type to a class', () => {
        const injector = new Injector();
        injector.mapType<SimpleType>(symbol1).toMapClass(SimpleTypeImpl);
        injector.map(SimpleTypeUser);
        const i1 = injector.getType(symbol1);
        const i2 = injector.get(SimpleTypeUser).simpleType;
        expect(i1 instanceof SimpleTypeImpl).toBeTruthy();
        expect(i2 instanceof SimpleTypeImpl).toBeTruthy();
        expect(i1).not.toBe(i2);
    });

    it('should map type to a (complex) class as singleton', () => {
        const injector = new Injector();
        injector.map(SimpleB).toSingleton();
        injector.map(SimpleA).toSingleton();
        injector.mapType<SimpleType>(symbol1).toMapClass(SimpleTypeImplB);
        injector.mapType<SimpleType>('test').toMapClassId(SimpleTypeImplB, 'single').toSingleton();

        const i1 = injector.getType(symbol1);
        const i2 = injector.getType('test');
        expect(i1).not.toBe(i2);
    });

    it('should throw error when no type mapping with the given id is found', () => {
        const injector = new Injector();
        expect(() => injector.getType('test')).toThrow('No TypeMapping');
    });

    it('should throw error when type isn´t mapped properly (there is no default mapping like with classes)', () => {
        const injector = new Injector();
        injector.mapType<SimpleType>('test');
        expect(() => injector.getType('test')).toThrow('No TypeMapping');
    });

    it('use mappings from parent injector if child injector has no mapping', () => {
        const injector = new Injector();
        const childInjector = injector.createChild();

        const sb = new SimpleB(new SimpleA());

        injector.map(SimpleA);
        injector.mapId(SimpleB, 'test').toValue(sb);
        childInjector.map(SimpleB);
        const simpleA1 = childInjector.get(SimpleA);
        expect(simpleA1 instanceof SimpleA).toBeTruthy();

        const simpleB = childInjector.get(SimpleB);

        expect(simpleB instanceof SimpleB).toBeTruthy();
        expect(childInjector.get(SimpleB, 'test')).toBe(sb);
        expect(simpleB.a instanceof SimpleA).toBeTruthy();
    });

    it('should work with symbol ids', () => {
        const injector = new Injector();
        const sa1 = new SimpleA();
        const sa2 = new SimpleA();
        injector.mapId(SimpleA, symbol1).toValue(sa1);
        injector.mapId(SimpleA, symbol2).toValue(sa2);
        injector.map(SimpleSymbol);

        const ss = injector.get(SimpleSymbol);
        expect(ss.a1).toBe(sa1);
        expect(ss.a2).toBe(sa2);

    });

    it('child injector should use instance map from parent', () => {
        const injector = new Injector();
        const childInjector = injector.createChild();

        injector.map(SimpleA).toSingleton();
        expect(injector.get(SimpleA)).toBe(childInjector.get(SimpleA));
    });

    it('child injector should override mapping from parent', () => {
        const injector = new Injector();
        const childInjector = injector.createChild();
        const sa1 = new SimpleA();
        const sa2 = new SimpleA();
        injector.map(SimpleA).toValue(sa1);
        childInjector.map(SimpleA).toValue(sa2);
        expect(injector.get(SimpleA)).toBe(sa1);
        expect(childInjector.get(SimpleA)).toBe(sa2);
    });

    it('should throw error when no mapping is found', () => {
        const injector = new Injector();
        expect(() => injector.get(SimpleA)).toThrow('No Mapping for Type');
        injector.map(SimpleA);
        expect(() => injector.get(SimpleA, 'id')).toThrow(`No Mapping for Type SimpleA with id: 'id'`);
    });

    it('should inject params', () => {
        const injector = new Injector();

        const params = {param1: 1, param2: 2};
        injector.map(SimpleParam, params);
        injector.map(SimpleB);
        injector.map(SimpleA);

        expect(injector.get(SimpleParam).params).toBe(params);
    });

    it('should throw when inject params are needed but not provided', () => {
        const injector = new Injector();
        expect(() => injector.map(SimpleParam)).toThrow();
    });

    it('should throw when inject params are provided but not needed', () => {
        const injector = new Injector();
        expect(() => injector.map(SimpleB, new SimpleA())).toThrow();
    });

    it('should throw error when trying to inject circular dependency', () => {
        const injector = new Injector();
        injector.map(CircularA);
        injector.map(CircularB);

        expect(() => injector.get(CircularA)).toThrow('Undefined dependency type');
    });

    it('should inject primitive types by mapping their constructor functions', () => {
        const injector = new Injector();
        injector.map(Boolean).toValue(true);
        injector.map(String).toValue("string");
        injector.map(Number).toValue(7);
        injector.map(Primitives);
        const primitive = injector.get(Primitives);
        expect(primitive.boolean).toBe(true);
        expect(primitive.string).toBe('string');
        expect(primitive.number).toBe(7);
    });

    it('should inject different named component keys', () => {

    });

    // it.skip('speed test', () => {
    //     const injector = new Injector();
    //
    //     injector.map(SimpleA).toSingleton();
    //     injector.map(SimpleB).toSingleton();
    //     injector.map(SimpleC);
    //
    //     console.time();
    //     for (let i = 0; i < 3_000_000; i++) {
    //         const instance = injector.get(SimpleC);
    //     }
    //     console.timeEnd();
    //     console.time();
    //     for (let i = 0; i < 3_000_000; i++) {
    //         const instance = injector.get(SimpleC);
    //     }
    //     console.timeEnd();
    //     console.time();
    //     for (let i = 0; i < 3_000_000; i++) {
    //         const instance = injector.get(SimpleC);
    //     }
    //     console.timeEnd();
    // });
});
