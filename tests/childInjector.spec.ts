import {Inject, Injector, InjectType} from '../src/injector';
import {SimpleA, SimpleB, SimpleType, SimpleTypeUser, symbol1} from './simpleClasses';

it('use mappings from parent injector if child injector has no mapping', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    const sb = new SimpleB(new SimpleA());

    injector.map(SimpleA);
    injector.map(SimpleB, 'test').toValue(sb);
    childInjector.map(SimpleB);
    const simpleA1 = childInjector.get(SimpleA);
    expect(simpleA1 instanceof SimpleA).toBeTruthy();

    const simpleB = childInjector.get(SimpleB);

    expect(simpleB instanceof SimpleB).toBeTruthy();
    expect(childInjector.get(SimpleB, 'test')).toBe(sb);
    expect(simpleB.a instanceof SimpleA).toBeTruthy();
});

it('use type mappings from child injector if it overrides other mappings', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    const mainA: SimpleType = {value: 'main'};
    const childA: SimpleType = {value: 'child'};

    injector.mapType<SimpleType>(symbol1).toValue(mainA);
    injector.map(SimpleTypeUser);
    childInjector.mapType<SimpleType>(symbol1).toValue(childA);

    const mainUser = injector.get(SimpleTypeUser);
    const childUser = childInjector.get(SimpleTypeUser);
    expect(mainUser.simpleType).toBe(mainA);
    expect(childUser.simpleType).toBe(childA);
});

it('use mappings from child injector if it overrides other mappings', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    const mainA = new SimpleA();
    const childA = new SimpleA();

    injector.map(SimpleA).toValue(mainA);
    injector.map(SimpleB);
    childInjector.map(SimpleA).toValue(childA);

    const mainB = injector.get(SimpleB);
    const childB = childInjector.get(SimpleB);
    expect(mainB.a).toBe(mainA);
    expect(childB.a).toBe(childA);
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

it('should use parent value for type in child injector', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    const value1 = {};
    const value2a = {};
    const value2b = {};
    injector.mapType('type1').toValue(value1);
    injector.mapType('type2').toValue(value2a);
    childInjector.mapType('type2').toValue(value2b);

    expect(injector.getType('type1')).toBe(value1);
    expect(childInjector.getType('type1')).toBe(value1);

    expect(injector.getType('type2')).toBe(value2a);
    expect(childInjector.getType('type2')).toBe(value2b);
});

it('should use parent value for class in child injector', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {}
    //@formatter:on

    const a = new A();
    const b1 = new B();
    const b2 = new B();

    injector.map(A).toValue(a);
    injector.map(B).toValue(b1);
    childInjector.map(B).toValue(b2);
    // injector.map(B);

    expect(injector.get(A)).toBe(a);
    expect(childInjector.get(A)).toBe(a);

    expect(injector.get(B)).toBe(b1);
    expect(childInjector.get(B)).toBe(b2);
});

it('should use child value when initial request comes from child', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {constructor(@Inject readonly a:A){}}
    //@formatter:on

    const a1 = new A();
    const a2 = new A();

    injector.map(A).toValue(a1);
    childInjector.map(A).toValue(a2);
    injector.map(B);
    // injector.get(B);
    // childInjector.get(B);
    expect(injector.get(B).a).toBe(a1);
    expect(childInjector.get(B).a).toBe(a2);
});

it('should use child value for type when initial request comes from child', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    type A = {};
    class B {constructor(@InjectType('a') readonly a:A){}}
    //@formatter:on

    const aValue1 = {};
    const aValue2 = {};

    injector.mapType('a').toValue(aValue1);
    childInjector.mapType('a').toValue(aValue2);
    injector.mapType('b').toClass(B);

    expect(injector.getType<B>('b').a).toBe(aValue1);
    expect(childInjector.getType<B>('b').a).toBe(aValue2);
});

it('child injector should use own singleton only on override ', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {}
    //@formatter:on

    injector.map(A).toSingleton();
    injector.map(B).toSingleton();
    childInjector.map(B).toSingleton();

    expect(injector.get(A)).toBe(childInjector.get(A));
    expect(injector.get(B)).not.toBe(childInjector.get(B));
});

it('child injector should use own singleton for type only on override', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {}
    //@formatter:on

    injector.mapType('A').toSingleton(A);
    injector.mapType('B').toSingleton(B);
    childInjector.mapType('B').toSingleton(B);

    expect(injector.getType('A')).toBe(childInjector.getType('A'));
    expect(injector.getType('B')).not.toBe(childInjector.getType('B'));
});

it('child injector should use own value only on override ', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {}
    //@formatter:on

    const aValue = new A();
    const bValue1 = new B();
    const bValue2 = new B();
    injector.map(A).toValue(aValue);
    injector.map(B).toValue(bValue1);
    childInjector.map(B).toValue(bValue2);

    expect(injector.get(A)).toBe(aValue);
    expect(childInjector.get(A)).toBe(aValue);
    expect(injector.get(B)).toBe(bValue1);
    expect(childInjector.get(B)).toBe(bValue2);
});

it('child injector should use own value for type only on override', () => {
    const injector = new Injector();
    const childInjector = injector.createChild();

    //@formatter:off
    class A {}
    class B {}
    //@formatter:on
    const valueA = new A();
    const valueB1 = new B();
    const valueB2 = new B();

    injector.mapType('A').toValue(valueA);
    injector.mapType('B').toValue(valueB1);
    childInjector.mapType('B').toValue(valueB2);

    expect(injector.getType('A')).toBe(valueA);
    expect(childInjector.getType('A')).toBe(valueA);
    expect(injector.getType('B')).toBe(valueB1);
    expect(childInjector.getType('B')).toBe(valueB2);

});
