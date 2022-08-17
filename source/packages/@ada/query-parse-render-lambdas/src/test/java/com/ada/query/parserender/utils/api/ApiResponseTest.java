/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.utils.api;

import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class ApiResponseTest {

    @Test
    public void buildResponseEvent_catches_exception_on_unserializable_input() throws Exception {

        class ClassThatJacksonCannotSerialize {
            final ClassThatJacksonCannotSerialize self = this;

            @Override
            public String toString() {
                return self.getClass().getName();
            }
        }

        ClassThatJacksonCannotSerialize unserializeable = new ClassThatJacksonCannotSerialize();
        APIGatewayProxyResponseEvent response = ApiResponse.success(unserializeable);
        Assertions.assertEquals(500, response.getStatusCode());
        Assertions.assertEquals("{\"message\": \"Failed to serialise response\"}", response.getBody());
    }

    @Test
    public void apiresponse_utility_class_cannot_be_instantiated() throws Exception {
        Constructor<ApiResponse> constructor = ApiResponse.class.getDeclaredConstructor();
        Assertions.assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        constructor.setAccessible(true);
        Assertions.assertThrows(InvocationTargetException.class, () -> {
            constructor.newInstance((Object[]) null);
        });
    }
}
