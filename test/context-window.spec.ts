import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextService } from '../src/core/ai/services/context.service';
import { MessageKeywordsService } from '../src/core/ai/services/message.keywords.service';
import { AIModelService } from '../src/core/ai/services/ai-model.service';
import {
  ChatSessionEntity,
  ChatMessageEntity,
  PromptTemplateEntity,
  AIModelEntity,
} from '../src/core/ai/entities';

describe('ContextService window and AIModelService.chatWithContext', () => {
  let module: TestingModule;
  let contextService: ContextService;
  let aiModelService: AIModelService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [
            ChatSessionEntity,
            ChatMessageEntity,
            PromptTemplateEntity,
            AIModelEntity,
          ],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          ChatSessionEntity,
          ChatMessageEntity,
          PromptTemplateEntity,
          AIModelEntity,
        ]),
      ],
      providers: [
        {
          provide: 'AI_CORE_OPTIONS',
          useValue: {
            context: { analysisWindowSize: 3 },
          },
        },
        ContextService,
        MessageKeywordsService,
        AIModelService,
      ],
    }).compile();

    contextService = module.get(ContextService);
    aiModelService = module.get(AIModelService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should use chat_session_messages and respect includeSystem in getRecentMessages', async () => {
    const sid = 'session-test-1';
    await contextService.createContext(sid, 'You are helpful');

    // Add 6 alternating user/assistant messages
    for (let i = 1; i <= 6; i++) {
      await contextService.addMessage(sid, {
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `${i % 2 === 1 ? 'U' : 'A'}${i}`,
      });
    }

    const withSys = await contextService.getRecentMessages(sid, 4, true);
    expect(withSys.length).toBe(5); // 1 system + 4 recent non-system
    expect(withSys[0].role).toBe('system');
    // Check ordering ascending by time for non-system
    const nonSys = withSys.slice(1);
    expect(nonSys.map((m) => m.content)).toEqual(['U3', 'A4', 'U5', 'A6']);

    const noSys = await contextService.getRecentMessages(sid, 4, false);
    expect(noSys.length).toBe(4);
    expect(noSys[0].role).not.toBe('system');
  });

  it('should respect analysisWindowSize in getAnalysisWindow', async () => {
    const sid = 'session-test-2';
    await contextService.createContext(sid, 'System prompt');
    for (let i = 1; i <= 5; i++) {
      await contextService.addMessage(sid, {
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `M${i}`,
      });
    }

    const winWithSys = await contextService.getAnalysisWindow(sid, true);
    expect(winWithSys.length).toBe(4); // 1 system + 3 non-system per analysisWindowSize
    expect(winWithSys[0].role).toBe('system');

    const winNoSys = await contextService.getAnalysisWindow(sid, false);
    expect(winNoSys.length).toBe(3);
    expect(winNoSys.every((m) => m.role !== 'system')).toBe(true);
  });

  it('AIModelService.chatWithContext should select window messages correctly', async () => {
    const sid = 'session-test-3';
    await contextService.createContext(sid, 'System');
    for (let i = 1; i <= 4; i++) {
      await contextService.addMessage(sid, {
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: `C${i}`,
      });
    }

    const spy = jest.spyOn(aiModelService, 'chat').mockResolvedValue({
      content: 'ok',
      model: 'm1',
      responseTime: 1,
      requestId: 'r',
    });

    await aiModelService.chatWithContext({
      modelId: 'm1',
      sessionId: sid,
      windowSize: 2,
      includeSystem: true,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const calledArgs = spy.mock.calls[0][0];
    expect(calledArgs.sessionId).toBe(sid);
    expect(Array.isArray(calledArgs.messages)).toBe(true);
    // 1 system + 2 recent non-system
    expect(calledArgs.messages.length).toBe(3);
    expect(calledArgs.messages[0].role).toBe('system');

    spy.mockRestore();
  });

  it('should build keyword window by user scope with similarity fallback when DB keywords absent', async () => {
    const userId = 'u1';
    const sidA = 'session-u1-a';
    const sidB = 'session-u1-b';
    await contextService.createContext(sidA, 'Sys A', userId);
    await contextService.createContext(sidB, 'Sys B', userId);

    // Populate messages in sidB (the most recently updated session)
    await contextService.addMessage(sidB, {
      role: 'user',
      content: 'I love red apples',
    });
    await contextService.addMessage(sidB, {
      role: 'assistant',
      content: 'Got it',
    });
    await contextService.addMessage(sidB, {
      role: 'user',
      content: 'Buying bananas today',
    });
    await contextService.addMessage(sidB, {
      role: 'assistant',
      content: 'Noted',
    });
    await contextService.addMessage(sidB, {
      role: 'user',
      content: 'Grapes are sweet',
    });

    // No DB keywords present (MessageKeywordsService is not invoked synchronously)
    // Expect similarity fallback to pick the message containing 'bananas'
    const winNoSys = await contextService.getKeywordContextByUser(
      userId,
      ['bananas'],
      false,
      3,
      'any',
    );
    expect(winNoSys.length).toBe(3);
    expect(winNoSys.every((m) => m.role !== 'system')).toBe(true);
    // The window should center around the 'Buying bananas today' message
    const contents = winNoSys.map((m) => m.content);
    expect(contents.includes('Buying bananas today')).toBe(true);

    const winWithSys = await contextService.getKeywordContextByUser(
      userId,
      ['bananas'],
      true,
      3,
      'any',
    );
    // 1 system + 3 non-system limited by window size (system prepends)
    expect(winWithSys.length).toBe(4);
    expect(winWithSys[0].role).toBe('system');
  });
});
