import {Inject, Injector, InjectType} from 'mani-injector';

interface IBar {
    readonly id: number;
}

class Foo {
    constructor(readonly id: number) {}
}

class Bar implements IBar {
    constructor(readonly id: number) {}
}

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @InjectType('bar') readonly bar: IBar,
    ) {}
}

const injector = new Injector();

let fooCount = 0;
const fooProvider = () => {
    return new Foo(fooCount++);
};

let barCount = 0;
const barProvider = () => {
    return new Bar(barCount++);
};
// every time Foo is requested the given provider function is called and the returned value is injected
injector.map(Foo).toProvider(fooProvider);
// every time the type with id 'bar' is requested the given provider function is called and the returned value is injected
injector.mapType<Bar>('bar').toProvider(barProvider);
// new instance is created every time FooBar is injected / requested
injector.map(FooBar);

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo.id); // 0
console.log(fooBar2.foo.id); // 1
console.log(fooBar1.bar.id); // 0
console.log(fooBar2.bar.id); // 1



