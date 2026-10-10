// Narrow declarations for the API used by Graph/layout3d.ts, based on d3-force-3d 3.x.
declare module "d3-force-3d" {
  export interface SimulationNodeDatum {
    index?: number
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    fx?: number | null
    fy?: number | null
    fz?: number | null
  }

  export interface SimulationLinkDatum<N extends SimulationNodeDatum> {
    source: N | string | number
    target: N | string | number
    index?: number
  }

  type Accessor<D> = (datum: D, index: number, data: D[]) => number
  type NumberOrAccessor<D> = number | Accessor<D>

  export interface Force<N extends SimulationNodeDatum> {
    (alpha: number): void
    initialize?(nodes: N[], ...args: Array<number | (() => number)>): void
  }

  export interface Simulation<N extends SimulationNodeDatum> {
    tick(iterations?: number): this
    stop(): this
    numDimensions(): number
    numDimensions(dimensions: number): this
    alpha(): number
    alpha(value: number): this
    alphaMin(): number
    alphaMin(value: number): this
    alphaDecay(): number
    alphaDecay(value: number): this
    velocityDecay(): number
    velocityDecay(value: number): this
    force(name: string): Force<N> | undefined
    force(name: string, force: Force<N> | null): this
  }

  export interface ForceLink<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>> extends Force<N> {
    id(): (node: N, index: number, nodes: N[]) => string | number
    id(accessor: (node: N, index: number, nodes: N[]) => string | number): this
    distance(): Accessor<L>
    distance(distance: NumberOrAccessor<L>): this
    strength(): Accessor<L>
    strength(strength: NumberOrAccessor<L>): this
  }

  export interface ForceManyBody<N extends SimulationNodeDatum> extends Force<N> {
    strength(): Accessor<N>
    strength(strength: NumberOrAccessor<N>): this
    distanceMin(): number
    distanceMin(distance: number): this
    distanceMax(): number
    distanceMax(distance: number): this
  }

  export interface ForceCollide<N extends SimulationNodeDatum> extends Force<N> {
    strength(): number
    strength(strength: number): this
    iterations(): number
    iterations(iterations: number): this
  }

  export interface ForcePosition<N extends SimulationNodeDatum> extends Force<N> {
    strength(): Accessor<N>
    strength(strength: NumberOrAccessor<N>): this
  }

  export interface ForceRadial<N extends SimulationNodeDatum> extends ForcePosition<N> {
    radius(): Accessor<N>
    radius(radius: NumberOrAccessor<N>): this
  }

  export function forceSimulation<N extends SimulationNodeDatum>(nodes?: N[], numDimensions?: number): Simulation<N>
  export function forceLink<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>>(links?: L[]): ForceLink<N, L>
  export function forceManyBody<N extends SimulationNodeDatum>(): ForceManyBody<N>
  export function forceCollide<N extends SimulationNodeDatum>(radius?: NumberOrAccessor<N>): ForceCollide<N>
  export function forceRadial<N extends SimulationNodeDatum>(radius: NumberOrAccessor<N>, x?: number, y?: number, z?: number): ForceRadial<N>
  export function forceX<N extends SimulationNodeDatum>(x?: NumberOrAccessor<N>): ForcePosition<N>
  export function forceY<N extends SimulationNodeDatum>(y?: NumberOrAccessor<N>): ForcePosition<N>
  export function forceZ<N extends SimulationNodeDatum>(z?: NumberOrAccessor<N>): ForcePosition<N>
}
