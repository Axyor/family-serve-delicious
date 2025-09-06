process.env.NODE_ENV = 'test';

jest.mock('@axyor/family-serve-database', () => ({
  Database: class Database { },
  EGender: { MALE: 'MALE', FEMALE: 'FEMALE' },
  EGroupRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER' },
  EDietaryRestrictionType: { FORBIDDEN: 'FORBIDDEN', REDUCED: 'REDUCED' },
  EDietaryRestriction: {
    VEGETARIAN: 'VEGETARIAN', VEGAN: 'VEGAN', GLUTEN_FREE: 'GLUTEN_FREE',
    DAIRY_FREE: 'DAIRY_FREE', NO_PORK: 'NO_PORK', LOW_CARB: 'LOW_CARB'
  },
  EActivityLevel: { SEDENTARY: 'SEDENTARY', LIGHTLY_ACTIVE: 'LIGHTLY_ACTIVE', MODERATELY_ACTIVE: 'MODERATELY_ACTIVE', VERY_ACTIVE: 'VERY_ACTIVE' },
  EHealthGoal: { WEIGHT_LOSS: 'WEIGHT_LOSS', MUSCLE_GAIN: 'MUSCLE_GAIN', MAINTENANCE: 'MAINTENANCE', IMPROVE_DIGESTION: 'IMPROVE_DIGESTION', HEART_HEALTH: 'HEART_HEALTH' },
  EBudgetLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  ECookingSkill: { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' },
  default: class Database { },
}));

const mod = require('../../src/index');

class MockDatabase {
  disconnect = jest.fn(async () => { });
}

describe('Unit: graceful shutdown', () => {
  test('SIGINT triggers db.disconnect and process.exit(0)', async () => {
    const mockDb = new MockDatabase() as any;
    mod.setDatabase(mockDb);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    process.emit('SIGINT');
    await new Promise((r) => setImmediate(r));

    expect(mockDb.disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
