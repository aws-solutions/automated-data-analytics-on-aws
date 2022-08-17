/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.model.rewrite;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Builder
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PRIVATE)
@EqualsAndHashCode
public class RewriteRequest {
    @SuppressWarnings("squid:S1068")
    private String query;

    @SuppressWarnings("squid:S1068")
    private Map<String, DataProduct> dataProducts;

    @SuppressWarnings("squid:S1068")
    private Map<String, QuerySubstitution> querySubstitutions;
}
