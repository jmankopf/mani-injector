
import {Inject, Injector} from 'mani-injector';

class Foo {}

class Bar {}

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @Inject readonly bar: Bar
    ) {}
}

const injector = new Injector();
const childInjector = injector.createChild();

const mainFoo = new Foo();
const childFoo = new Foo();


injector.map(Foo).toValue(mainFoo);
injector.map(Bar).toSingleton();
injector.map(FooBar);

// we override the mapping of Foo to the value childFoo
childInjector.map(Foo).toValue(childFoo);

const mainFooBar = injector.get(FooBar);

// FooBar is requested from the childInjector, the request is forwarded to the parent because the child injector has no mapping for it
const childFooBar = childInjector.get(FooBar);

// Bar is mapped in parent injector to a singleton and not overridden by the child injector
console.log(mainFooBar.bar === childFooBar.bar);
// Foo is overridden in child injector and mapped to the value childFoo
console.log(childFooBar.foo === childFoo);
