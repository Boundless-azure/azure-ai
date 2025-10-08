// 示例插件配置（纯数据对象，便于运行时转译与加载）
const pluginConfig = {
  name: 'customer-analytics',
  version: '1.0.0',
  description:
    '提供用户生命周期相关事件的分析与扩展处理，包括用户注册、资料更新、订单支付等典型业务事件。',
  hooks: [
    {
      name: 'customer.created',
      payloadDescription:
        '当用户完成注册后触发，包含用户基础信息（id、email、注册渠道、时间戳等）。',
    },
    {
      name: 'customer.profile.updated',
      payloadDescription:
        '当用户更新个人资料时触发（姓名、地址、偏好、联系方式等变更）。',
    },
    {
      name: 'order.paid',
      payloadDescription:
        '当订单支付成功后触发，包含订单号、用户id、支付方式、金额、时间戳等信息。',
    },
  ],
};

export default pluginConfig;
