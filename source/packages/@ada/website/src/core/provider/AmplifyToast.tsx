/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Container } from 'aws-northstar';
import Button from '@material-ui/core/Button';
import React from 'react';
import Typography from '@material-ui/core/Typography'

export interface AmplifyToastProperties {
    message: string;
    handleClose: ()=>void;
}

export const AmplifyToast: React.FC<AmplifyToastProperties> = ({message, handleClose}) => {
    return (
        <Container headingVariant="h4" style={{marginBottom: 0}}>
            <Typography variant="h3" component="label" gutterBottom>{message}</Typography>
            <Button variant="contained" color="primary" onClick={() => handleClose()} style={{float: "right", marginLeft: "auto", marginRight: 0}}>Hide</Button>
        </Container>)
}