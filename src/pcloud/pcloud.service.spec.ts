import { Test, TestingModule } from '@nestjs/testing';
import { PcloudService } from './pcloud.service';

describe('PcloudService', () => {
  let service: PcloudService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PcloudService],
    }).compile();

    service = module.get<PcloudService>(PcloudService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
