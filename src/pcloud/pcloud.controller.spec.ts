import { Test, TestingModule } from '@nestjs/testing';
import { PcloudController } from './pcloud.controller';

describe('PcloudController', () => {
  let controller: PcloudController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PcloudController],
    }).compile();

    controller = module.get<PcloudController>(PcloudController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
