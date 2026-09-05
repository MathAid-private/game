import type { IGameLogic } from '@games/loop';
import type { IControllerDriver, IControllerMapper, IControllerVendor, VPadData } from '../types';

export abstract class BaseControllerVendor<
  D extends VPadData,
  GL extends IGameLogic = IGameLogic,
> implements IControllerVendor<GL, D> {
  abstract readonly driver: IControllerDriver<GL, D>;
  abstract readonly parser: IControllerMapper<D>;
}
