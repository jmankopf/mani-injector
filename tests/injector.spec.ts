import {Inject, Injector} from '../src/injector';
import {
    CircularA,
    DependantA,
    DependencyA,
    Primitives,
    SimpleA,
    SimpleB,
    SimpleC,
    SimpleId,
    SimpleSymbol,
    SimpleType,
    SimpleTypeImpl,
    SimpleTypeImplB,
    SimpleTypeUser,
    symbol1,
    symbol2,
} from './simpleClasses';
import {CircularB} from './circularB';
import {MultiTypeA, MultiTypeB} from './multipleTypes';

it('dependencies of annotated classes should have been added', () => {
    const deps = Injector.dependencyMap.get(DependantA);
    if (!deps) throw new Error();
    expect(deps.length).toBe(3);
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
    injector.map(DependencyA, 'id').toValue(dependencyA2);
    expect(injector.get(DependencyA)).toBe(dependencyA1);
    expect(injector.get(DependencyA, 'id')).toBe(dependencyA2);
});

it('should map to singleton', () => {
    const injector = new Injector();
    injector.map(DependencyA).toSingleton();
    injector.map(DependencyA, 'id').toSingleton();
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
    injector.map(SimpleA, 'one').toValue(simpleA);
    injector.map(SimpleA, 'two').toSingleton();
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
    injector.mapType<SimpleType>(symbol1).toClass(SimpleTypeImpl);
    injector.map(SimpleTypeUser);
    const i1 = injector.getType(symbol1);
    const i2 = injector.get(SimpleTypeUser).simpleType;
    const i3 = injector.get(SimpleTypeUser).simpleType;
    expect(i1 instanceof SimpleTypeImpl).toBeTruthy();
    expect(i2 instanceof SimpleTypeImpl).toBeTruthy();
    expect(i3 instanceof SimpleTypeImpl).toBeTruthy();
    expect(i1).not.toBe(i2);
    expect(i2).not.toBe(i3);
});

it('should map type to a (complex) class as singleton', () => {
    const injector = new Injector();
    injector.map(SimpleB).toSingleton();
    injector.map(SimpleA).toSingleton();
    injector.mapType<SimpleType>(symbol1).toClass(SimpleTypeImplB);
    injector.mapType<SimpleType>('test').toSingleton(SimpleTypeImplB);

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

it('should work with symbol ids', () => {
    const injector = new Injector();
    const sa1 = new SimpleA();
    const sa2 = new SimpleA();
    injector.map(SimpleA, symbol1).toValue(sa1);
    injector.map(SimpleA, symbol2).toValue(sa2);
    injector.map(SimpleSymbol);

    const ss = injector.get(SimpleSymbol);
    expect(ss.a1).toBe(sa1);
    expect(ss.a2).toBe(sa2);

});

it('should throw error when no mapping is found', () => {
    const injector = new Injector();
    expect(() => injector.get(SimpleA)).toThrow('No Mapping for Type');
    injector.map(SimpleA);
    expect(() => injector.get(SimpleA, 'id')).toThrow(`No Mapping for Type SimpleA with id: 'id'`);
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
    injector.map(String).toValue('string');
    injector.map(Number).toValue(7);
    injector.map(Primitives);
    const primitive = injector.get(Primitives);
    expect(primitive.boolean).toBe(true);
    expect(primitive.string).toBe('string');
    expect(primitive.number).toBe(7);
});

it('should not inject same instance of mapped type', () => {
    const injector = new Injector();

    injector.mapType('typeA').toClass(MultiTypeA);
    injector.mapType('myTest').toClass(MultiTypeB);

    const typeB1 = injector.getType<MultiTypeB>('myTest');
    const typeB2 = injector.getType<MultiTypeB>('myTest');
    expect(typeB1.multiTypeA instanceof MultiTypeA).toBeTruthy();
    expect(typeB2.multiTypeA instanceof MultiTypeA).toBeTruthy();
    expect(typeB1.multiTypeA).not.toBe(typeB2.multiTypeA);

});

it('should override singleton and singleton with id', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class B {}
    class A {constructor(@Inject readonly b:B){}}
    //@formatter:on

    const b1 = new B();
    const b2 = new B();

    injector.map(B).toValue(b1);
    injector.map(A).toSingleton();
    injector.map(A, 'id').toSingleton();
    childInjector.map(A).toSingleton();
    childInjector.map(B).toValue(b2);
    childInjector.map(A, 'id').toSingleton();

    expect(injector.get(A)).not.toBe(injector.get(A, 'id'));
    expect(injector.get(A)).not.toBe(childInjector.get(A));

    expect(injector.get(A).b).toBe(b1);
    expect(injector.get(A, 'id').b).toBe(b1);
    expect(childInjector.get(A).b).toBe(b2);
    expect(childInjector.get(A, 'id').b).toBe(b2);

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
