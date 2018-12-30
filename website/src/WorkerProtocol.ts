export type Message =
  | {type: "SET_CONFIG"; config: WorkerConfig}
  | {type: "RUN_SUCRASE"}
  | {type: "RUN_BABEL"}
  | {type: "RUN_TYPESCRIPT"}
  | {type: "COMPRESS_CODE"}
  | {type: "GET_TOKENS"}
  | {type: "PROFILE_SUCRASE"}
  | {type: "PROFILE_BABEL"}
  | {type: "PROFILE_TYPESCRIPT"};

export type WorkerMessage =
  | {type: "RESPONSE"; response: unknown}
  | {type: "BABEL_LOADED"}
  | {type: "TYPESCRIPT_LOADED"};

export interface WorkerConfig {
  compareWithBabel: boolean;
  compareWithTypeScript: boolean;
  code: string;
  selectedTransforms: {[transformName: string]: boolean};
  showTokens: boolean;
}
