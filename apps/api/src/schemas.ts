import { Type } from 'typebox';

const SiteId = Type.String({ minLength: 1, maxLength: 8 });
const site = <T extends string>(type: T) => Type.Object({ type: Type.Literal(type), siteId: SiteId });
const PlantType = Type.Union(['wind', 'off', 'solar', 'batt', 'hydro', 'pump'].map((t) => Type.Literal(t)));
const Region = Type.Union(['nd', 'ns', 'ib', 'al'].map((t) => Type.Literal(t)));
const Trick = Type.Union(['klage', 'bi', 'hack'].map((t) => Type.Literal(t)));
const Money = Type.Integer({ minimum: 1, maximum: 1e10 });

export const ActionSchema = Type.Union([
  site('survey'),
  site('lease'),
  Type.Object({ type: Type.Literal('applyPermit'), siteId: SiteId, plantType: PlantType }),
  site('changePlantType'),
  site('build'),
  site('connectGrid'),
  site('repairSelf'),
  site('repairService'),
  site('sellSite'),
  Type.Object({ type: Type.Literal('reserveGrid'), region: Region }),
  Type.Object({ type: Type.Literal('acceptContract'), offerId: Type.Integer({ minimum: 0 }) }),
  Type.Object({ type: Type.Literal('borrow'), amount: Money }),
  Type.Object({ type: Type.Literal('repay'), amount: Type.Union([Money, Type.Literal('all')]) }),
  Type.Object({ type: Type.Literal('lobby'), trick: Trick, siteId: SiteId }),
  Type.Object({
    type: Type.Literal('minigameResult'),
    challengeId: Type.Integer({ minimum: 0 }),
    outcome: Type.Union([Type.Number(), Type.Boolean()]),
  }),
]);

export const CreateGameBody = Type.Object({
  companyName: Type.String({ maxLength: 40 }),
  autoMinigames: Type.Boolean(),
  difficulty: Type.Optional(Type.Union([Type.Literal('easy'), Type.Literal('normal'), Type.Literal('hard')])),
});

export const ActionBody = Type.Object({ action: ActionSchema });

export const GameParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 64 }) });
