# mani-injector

Very fast and lightweight dependency injection for typescript

## Usage
```
$ npm install mani-injector --save
```

#### Injecting classes
```typescript
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
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true
```
#### Injecting classes with id
```typescript
import {InjectId, Injector} from 'mani-injector';

class Foo {}

class FooBar {
    constructor(
        @InjectId('first') readonly foo1: Foo,
        @InjectId('second') readonly foo2: Foo,
    ) {}
}

const injector = new Injector();

injector.map(Foo, 'first');                 // new instance is created every time Foo is requested with the id 'first'
injector.map(Foo, 'second').toSingleton();  // single instance is returned every time Foo is requested with the id 'second'
injector.map(FooBar);                          // new instance is created every time FooBar is injected / requested

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo1 !== fooBar2.foo1); // true
console.log(fooBar1.foo2 === fooBar2.foo2); // true
```
#### Injecting types
```typescript
import {Injector, InjectType} from 'mani-injector';

interface IFoo {}
interface IBar {}
interface IFooBar {
    readonly foo: IFoo;
    readonly bar: IBar;
}

const barSymbol = Symbol('Bar');

class Foo implements IFoo {}

class Bar implements IBar{}

class FooBar implements IFooBar {
    constructor(
        @InjectType('foo') readonly foo: IFoo,
        @InjectType(barSymbol) readonly bar: IBar
    ) {}
}

const injector = new Injector();

// every time the type with the id 'foo' is requested a new instance of Foo is created
injector.mapType<IFoo>('foo').toClass(Foo);
// every time the type with the symbol 'barSymbol' is requested a single instance of Bar is returned
injector.mapType<IBar>(barSymbol).toSingleton(Bar);
// every time the type with the id 'myFooBar' is requested a new instance of FooBar is created
injector.mapType<IFooBar>('myFooBar').toClass(FooBar); 

const fooBar1 = injector.getType<IFooBar>('myFooBar');
const fooBar2 = injector.getType<IFooBar>('myFooBar');

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar

console.log(fooBar1.foo !== fooBar2.foo); // true
console.log(fooBar1.bar === fooBar2.bar); // true
console.log(fooBar1.bar instanceof Bar); // true
console.log(fooBar1.foo instanceof Foo); // true
```
#### Map to value
```typescript
import {Inject, Injector, InjectType} from 'mani-injector';

class Foo {}
type Bar = { id: number };

class FooBar {
    constructor(
        @Inject readonly foo: Foo,
        @InjectType('bar') readonly bar: Bar,
    ) {}
}

const injector = new Injector();

const fooValue = new Foo();
const barValue = {id: 1};

// every time Foo is requested return the given value 'fooValue'
injector.map(Foo).toValue(fooValue);
// every time the type with id 'bar' is requested return the given value 'barValueÄ
injector.mapType<Bar>('bar').toValue(barValue);
// new instance is created every time FooBar is injected / requested
injector.map(FooBar);

const fooBar1 = injector.get(FooBar);
const fooBar2 = injector.get(FooBar);

// There are 2 instances of FooBar, 2 instances of Foo and only 1 instance of Bar
console.log(fooBar1.foo === fooValue); // true
console.log(fooBar2.foo === fooValue); // true
console.log(fooBar1.bar === barValue); // true
console.log(fooBar2.bar === barValue); // true
```

#### Map to provider
```typescript
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
```

#### Use child injector
```typescript
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
```

#### Use entity component system
```typescript
import {EntityComponent, GetComponent, GetEntity, Inject, Injector} from 'mani-injector';

class Service {}

class FooComponent {}
class BarComponent {}

class FirstEntity {
    @EntityComponent
    foo: FooComponent = new FooComponent();
}

class SecondEntity {
    @EntityComponent
    foo: FooComponent = new FooComponent();
    @EntityComponent
    bar: BarComponent = new BarComponent();
}

// this system is created for every entity that has a FooComponent
class FooSystem {
    constructor(
        @GetComponent readonly foo: FooComponent, // get a reference to the component when the system is created for a specific entity
        @GetEntity readonly entity:Object // you can get the entity object
    ) {}
}

// this system is created for every entity that has a BarComponent
class BarSystem {
    constructor(
        @GetComponent readonly bar: BarComponent,
    ) {}
}

// this system is created for every entity that has a FooComponent and a BarComponent
class FooBarSystem {
    constructor(
        @GetComponent readonly foo: FooComponent,
        @GetComponent readonly bar: BarComponent,
        @Inject readonly service: Service // you can inject everything that is mapped in the injector
    ) {}
}


const injector = new Injector();

injector.registerSystem(FooSystem);
injector.registerSystem(BarSystem);
injector.registerSystem(FooBarSystem);
injector.map(Service).toSingleton();

const entity1 = new FirstEntity();
const entity2 = new SecondEntity();

// array with one instance of FooSystem with a reference to the component
console.log(injector.createSystems(entity1));

// array with 3 systems
// one instance of FooSystem
// one instance of BarSystem
// one instance of FooBarSystem
console.log(injector.createSystems(entity2));
```
