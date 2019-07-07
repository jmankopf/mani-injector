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
