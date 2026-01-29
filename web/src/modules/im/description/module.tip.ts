/**
 * @title IM Module Tip (Web)
 * @description 前端 IM 模块的描述与关键词/函数哈希映射，便于快速检索关联代码。
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description:
    'IM 前端模块提供实时聊天的 Socket 服务、组合函数与状态管理，包括房间加入/离开、输入状态、已读回执、增量拉取等能力。',
  keywords: {
    cn: {
      IM常量: 'src/modules/im/constants/im.constants.ts',
      IM类型: 'src/modules/im/types/im.types.ts',
      IMSocket服务: 'src/modules/im/services/im.socket.service.ts',
      IMStore: 'src/modules/im/store/im.store.ts',
      IMHook: 'src/modules/im/hooks/useImChat.ts',
      IM模块入口: 'src/modules/im/im.module.ts',
      加入房间: 'src/modules/im/services/im.socket.service.ts',
      离开房间: 'src/modules/im/services/im.socket.service.ts',
      输入状态: 'src/modules/im/services/im.socket.service.ts',
      已读回执: 'src/modules/im/services/im.socket.service.ts',
      增量拉取: 'src/modules/im/store/im.store.ts',
      打开会话: 'src/modules/im/store/im.store.ts',
    },
    en: {
      im_constants: 'src/modules/im/constants/im.constants.ts',
      im_types: 'src/modules/im/types/im.types.ts',
      im_socket_service: 'src/modules/im/services/im.socket.service.ts',
      im_store: 'src/modules/im/store/im.store.ts',
      im_hook: 'src/modules/im/hooks/useImChat.ts',
      im_module_entry: 'src/modules/im/im.module.ts',
      join_room: 'src/modules/im/services/im.socket.service.ts',
      leave_room: 'src/modules/im/services/im.socket.service.ts',
      typing_status: 'src/modules/im/services/im.socket.service.ts',
      read_receipt: 'src/modules/im/services/im.socket.service.ts',
      incremental_pull: 'src/modules/im/store/im.store.ts',
      open_session: 'src/modules/im/store/im.store.ts',
    },
  },
  hashes: {
    im_socket_connect: 'hash_im_socket_connect_001',
    im_socket_join_room: 'hash_im_socket_join_room_002',
    im_socket_leave_room: 'hash_im_socket_leave_room_003',
    im_socket_join_notify: 'hash_im_socket_join_notify_004',
    im_socket_leave_notify: 'hash_im_socket_leave_notify_005',
    im_socket_send_typing: 'hash_im_socket_send_typing_006',
    im_socket_send_read: 'hash_im_socket_send_read_007',
    im_store_load_sessions_initial: 'hash_im_store_load_sessions_008',
    im_store_pull_sessions_incremental: 'hash_im_store_pull_sessions_009',
    im_store_load_messages_initial: 'hash_im_store_load_messages_010',
    im_store_pull_messages_incremental: 'hash_im_store_pull_messages_011',
    im_store_open_session: 'hash_im_store_open_session_012',
    im_store_send_message: 'hash_im_store_send_message_013',
    use_im_chat_connect: 'hash_use_im_chat_connect_014',
    use_im_chat_join_session: 'hash_use_im_chat_join_session_015',
  },
};
