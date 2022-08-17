/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.lens;

import com.amazonaws.athena.connector.lambda.handlers.UserDefinedFunctionHandler;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.hash.Hashing;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.core.retry.backoff.EqualJitterBackoffStrategy;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.SecretsManagerException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class AthenaLensHandler extends UserDefinedFunctionHandler {
    private static final Logger logger = LoggerFactory.getLogger(AthenaLensHandler.class);

    private static final String SOURCE_TYPE = "athena_common_lens";
    private static final String SALT_ARN = System.getenv("SALT_ARN");

    @VisibleForTesting
    protected SecretsManagerClient secretsManagerClient;

    private byte[] cachedSecretSalt = new byte[0];

    public AthenaLensHandler() {
        super(SOURCE_TYPE);
        this.secretsManagerClient = createSecretsManagerClient();
    }

    public AthenaLensHandler(SecretsManagerClient secretsManagerClient) {
        super(SOURCE_TYPE);
        this.secretsManagerClient = secretsManagerClient;
    }

    /**
     * Creates the client configuration with retries, backoffs and jitter
     */
    @VisibleForTesting
    protected ClientOverrideConfiguration createClientOverrideConfiguration() {
        // delays in milliseconds
        int retryBaseDelay = 500;
        int retryMaxBackoffTime = 600000;
        int maxRetries = 10;
        int timeout = 600000;
        RetryPolicy retryPolicy = RetryPolicy.defaultRetryPolicy().toBuilder()
                .numRetries(maxRetries)
                .backoffStrategy(EqualJitterBackoffStrategy.builder()
                        .baseDelay(Duration.ofMillis(retryBaseDelay))
                        .maxBackoffTime(Duration.ofMillis(retryMaxBackoffTime))
                        .build())
                .build();
        return ClientOverrideConfiguration.builder()
                .apiCallTimeout(Duration.ofMillis(timeout))
                .apiCallAttemptTimeout(Duration.ofMillis(timeout))
                .retryPolicy(retryPolicy)
                .build();
    }

    /**
     * Creates a secrets manager client
     * @return SecretsManagerClient
     */
    private SecretsManagerClient createSecretsManagerClient() {
        return SecretsManagerClient.builder()
                .overrideConfiguration(createClientOverrideConfiguration())
                .build();
    }

    /**
     * Returns the secret to use as salt for the hash
     */
    private byte[] getSecretSalt() {
        // Retrieve the secret if it's not already cached
        if (this.cachedSecretSalt.length == 0) {
            logger.info("Fetching secret salt from secrets manager");
            try {
                this.cachedSecretSalt = secretsManagerClient
                        .getSecretValue(GetSecretValueRequest.builder()
                                .secretId(SALT_ARN)
                                .build())
                        .secretString()
                        .getBytes(StandardCharsets.UTF_8);
            } catch (SecretsManagerException e) {
                logger.error(e.awsErrorDetails().errorMessage(), e);
                throw e;
            }
        }
        return this.cachedSecretSalt;
    }

    /**
     * Hashes a valid UTF-8 String.
     * Hash algorithm is SHA256
     *
     * @param input the String to be hashed
     * @return the hashed String
     */
    @SuppressWarnings("squid:S100")
    public String ada_hash(String input) {
        if (input == null)
            return null;

        byte[] salt = getSecretSalt();

        byte[] text = input.getBytes(StandardCharsets.UTF_8);

        // combine two byte arrays
        byte[] inputBytes = ByteBuffer.allocate(salt.length + text.length)
                .put(salt)
                .put(text)
                .array();

        return Hashing.sha256().hashBytes(inputBytes).toString().substring(0, 32);
    }
}
