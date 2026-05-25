export type BlueAirMqttAuth = {
  broker: string;
  customAuthorizerName: string;
  customAuthorizerSignature: string;
  customAuthorizerToken: string;
  userId?: string;
};
