export type SecretMap = Record<string, string>;
export interface SecretsConfig {
    inline?: Record<string, string>;
    env?: Record<string, string>;
    files?: Array<{
        key: string;
        path: string;
        encoding?: BufferEncoding;
    }>;
    dotenv?: {
        path?: string;
        encoding?: BufferEncoding;
        required?: boolean;
    };
}
export declare function resolveSecrets(config: SecretsConfig | undefined, configDir: string): Promise<SecretMap>;
export declare function applySecrets(value: unknown, secrets: SecretMap): unknown;
//# sourceMappingURL=secrets.d.ts.map