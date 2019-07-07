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

// new instance is created every time Foo is injected / requested
injector.map(Foo);
// Bar is only created once and that instance is used everywhere
injector.map(Bar).toSingleton();
// new instance is created every time FooBar is injected / requested
injector.map(FooBar);

const fooBar1 = injector.get(FooBar);
debugger;
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true
