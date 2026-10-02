import { Type } from 'typebox';
import { DIFFICULTY_KEYS, PLANT_TYPE_KEYS, REGION_KEYS, TRICK_KEYS } from '@power-tycoon/engine';

/** One of the given string literals (the lists come from the engine). */
const oneOf = <K extends string>(keys: readonly K[]) => Type.Union(keys.map((k) => Type.Literal(k)));

const SiteId = Type.String({ minLength: 1, maxLength: 8 });
const site = <T extends string>(type: T) => Type.Object({ type: Type.Literal(type), siteId: SiteId });
const Money = Type.Integer({ minimum: 1, maximum: 1e10 });

export const ActionSchema = Type.Union([
  site('survey'),
  site('lease'),
  Type.Object({ type: Type.Literal('applyPermit'), siteId: SiteId, plantType: oneOf(PLANT_TYPE_KEYS) }),
  site('changePlantType'),
  site('build'),
  site('connectGrid'),
  site('repairSelf'),
  site('repairService'),
  site('sellSite'),
  Type.Object({ type: Type.Literal('reserveGrid'), region: oneOf(REGION_KEYS) }),
  Type.Object({ type: Type.Literal('acceptContract'), offerId: Type.Integer({ minimum: 0 }) }),
  Type.Object({ type: Type.Literal('borrow'), amount: Money }),
  Type.Object({ type: Type.Literal('repay'), amount: Type.Union([Money, Type.Literal('all')]) }),
  Type.Object({ type: Type.Literal('lobby'), trick: oneOf(TRICK_KEYS), siteId: SiteId }),
  Type.Object({
    type: Type.Literal('minigameResult'),
    challengeId: Type.Integer({ minimum: 0 }),
    outcome: Type.Union([Type.Number(), Type.Boolean()]),
  }),
]);

export const CreateGameBody = Type.Object({
  companyName: Type.String({ maxLength: 40 }),
  autoMinigames: Type.Boolean(),
  difficulty: Type.Optional(oneOf(DIFFICULTY_KEYS)),
});

export const ActionBody = Type.Object({ action: ActionSchema });

export const GameParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 64 }) });
