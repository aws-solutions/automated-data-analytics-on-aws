/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.pii.detection.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PRIVATE)
@EqualsAndHashCode
public class PiiType
{
    @SuppressWarnings("squid:S1068")
    private Float score;

    @SuppressWarnings("squid:S1068")
    private String type;

    @SuppressWarnings("squid:S1068")
    private Integer beginOffset;

    @SuppressWarnings("squid:S1068")
    private Integer endOffset;
}
