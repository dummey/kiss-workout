declare module 'body-muscles' {
  export enum ViewSide {
    FRONT = 'front',
    BACK = 'back'
  }

  export interface BodyStateItem {
    intensity: number
    selected: boolean
  }

  export interface BodyState {
    [key: string]: BodyStateItem
  }

  export interface BodyChartOptions {
    view: ViewSide | string
    bodyState?: BodyState
    showViewLabel?: boolean
  }

  export class BodyChart {
    constructor(container: HTMLElement, options: BodyChartOptions)
    update(options: Partial<BodyChartOptions>): void
    destroy(): void
  }
}
