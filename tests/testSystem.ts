import {EntityComponent, GetComponent, GetEntity, Inject, Injector} from '../src/injector';

export class CompTestA {
    valueA = 'testA';
}

export class CompTestB {
    valueB = 'testB';
}

export class CompTestC {
    valueC = 'testC';
}

export class CompTestEntityA {
    @EntityComponent
    readonly compTestA: CompTestA = new CompTestA();
}

export class CompTestEntityB {
    @EntityComponent
    readonly cTestA: CompTestA = new CompTestA();
    @EntityComponent
    readonly compTestB: CompTestB = new CompTestB();
}

export class SystemDependency {
    value = 'SystemDependency';
}

export class CompTestEntityC {
    @EntityComponent
    readonly cTestB: CompTestB = new CompTestB();

    @EntityComponent
    readonly compTestC: CompTestC = new CompTestC();
}

export class CompTestSystemA {
    constructor(
        @GetComponent readonly componentA: CompTestA,
        @GetEntity readonly entity: Object,
        @Inject readonly dep: SystemDependency,
        @Inject readonly injector: Injector,
    ) {
    }
}

export class CompTestSystemAJustComponent {
    constructor(
        @GetComponent readonly componentA: CompTestA,
        @Inject readonly injector: Injector,
    ) {
    }
}
export class CompTestSystemAJustEntity {
    constructor(
        @GetEntity readonly entity: Object,
        @Inject readonly injector: Injector,
    ) {
    }
}

export class CompTestSystemB {
    constructor(
        @GetComponent readonly componentA: CompTestA,
        @GetComponent readonly componentB: CompTestB,
        @GetEntity readonly entity: Object,
        @Inject readonly injector: Injector,
    ) {
    }
}

export class CompTestSystemC {
    constructor(
        @GetComponent readonly componentA: CompTestA,
        @GetComponent readonly componentB: CompTestC,
        @GetEntity readonly entity: Object,
        @Inject readonly injector: Injector,
    ) {
    }
}
export class CompTestSystemD {
    constructor(
        @GetEntity readonly entity: Object,
        @Inject readonly injector: Injector,
    ) {
    }
}
