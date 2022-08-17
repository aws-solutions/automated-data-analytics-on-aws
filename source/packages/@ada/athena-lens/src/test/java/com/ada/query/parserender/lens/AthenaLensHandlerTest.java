/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.lens;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.SecretsManagerException;
import uk.org.webcompere.systemstubs.environment.EnvironmentVariables;
import uk.org.webcompere.systemstubs.jupiter.SystemStub;
import uk.org.webcompere.systemstubs.jupiter.SystemStubsExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(SystemStubsExtension.class)
@ExtendWith(MockitoExtension.class)
public class AthenaLensHandlerTest {

    @Mock
    private SecretsManagerClient mockSecretsManagerClient;

    @SystemStub
    static EnvironmentVariables testWideVariables;

    @BeforeAll
    static void beforeAll() {
        testWideVariables.set("SALT_ARN", "salt");
    }

    @Test
    public void testHashReturnsAlphaNumericCharacters() throws Exception {
        Mockito.doReturn(GetSecretValueResponse.builder()
                .secretString("secret")
                .build()).when(mockSecretsManagerClient).getSecretValue(Mockito.<GetSecretValueRequest>any());
        String input = "StringToBeHashed";
        String hashed = new AthenaLensHandler(mockSecretsManagerClient).ada_hash(input);
        assertEquals(32, hashed.length());
        assertTrue(hashed.matches("^[a-f0-9]{32}$"));
    }

    @Test
    public void testHashWithNullInput() {
        assertNull(new AthenaLensHandler(mockSecretsManagerClient).ada_hash(null));
    }

    @Test
    public void testHashIsConsistentForSameInput() {
        Mockito.doReturn(GetSecretValueResponse.builder()
                .secretString("secret")
                .build()).when(mockSecretsManagerClient).getSecretValue(Mockito.<GetSecretValueRequest>any());
        AthenaLensHandler athenaLensHandler = new AthenaLensHandler(mockSecretsManagerClient);

        String input = "StringToBeHashed";
        assertEquals(athenaLensHandler.ada_hash(input), athenaLensHandler.ada_hash(input));

        // Should only fetch the secret once
        Mockito.verify(mockSecretsManagerClient, Mockito.times(1)).getSecretValue(Mockito.<GetSecretValueRequest>any());
    }

    @Test
    public void testCreateClientOverrideConfiguration() {
        assertTrue(new AthenaLensHandler(mockSecretsManagerClient).createClientOverrideConfiguration().apiCallAttemptTimeout().isPresent());
    }

    @Test
    public void testThrowsExceptionWhenSecretsManagerFails() {
        Mockito.doThrow(SecretsManagerException.builder().build())
                .when(mockSecretsManagerClient).getSecretValue(Mockito.<GetSecretValueRequest>any());

        assertThrows(RuntimeException.class, () -> {
            new AthenaLensHandler(mockSecretsManagerClient).ada_hash("input");
        });
    }
}
