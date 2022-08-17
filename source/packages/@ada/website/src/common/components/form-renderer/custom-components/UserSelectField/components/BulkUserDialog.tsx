/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, FormField, Inline, Modal, Textarea } from 'aws-northstar';
import { JSONSCHEMA_VALIDATOR } from '$common/components/form-renderer/validators';
import { isEmpty, trim, uniq } from 'lodash';
import { useI18nContext } from '$strings';
import React, { useCallback, useState } from 'react';

export interface BulkMemberDialogProps {
  onClose: () => void;
  onSave: (users: string[]) => void;
}

const userValidator = JSONSCHEMA_VALIDATOR({ schema: 'USER_IDENTIFIER' });

const DELIMITER = /[,;\s]+/;

export const BulkMemberDialog: React.FC<BulkMemberDialogProps> = ({ onClose, onSave }) => {
  const { LL } = useI18nContext();
  const [visible, setVisible] = useState(true);
  const [value, setValue] = useState<string>();
  const [errorText, setErrorText] = useState<string>();

  const changeHandler = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>(
    (event) => {
      setValue(event.target.value);
    },
    [setValue],
  );

  const saveHandler = useCallback(() => {
    setErrorText(undefined);

    if (value == null || isEmpty(value)) {
      setErrorText('Required');
      return;
    }
    const users = uniq(value.split(DELIMITER).map(trim));

    for (const user in users) {
      const error = userValidator(user);
      if (error != null) {
        setErrorText(error as string);
        return;
      }
    }

    setVisible(false);
    onSave(users);
  }, [onSave, setVisible, value]);

  const closeHandler = useCallback(() => {
    setVisible(false);
    onClose && onClose();
  }, [onClose]);

  return (
    <Modal
      title={LL.VIEW.GROUP.BulkDialog.title()}
      subtitle={LL.VIEW.GROUP.BulkDialog.description()}
      visible={visible}
      onClose={onClose}
    >
      <FormField
        controlId="bulk-users"
        label={LL.VIEW.GROUP.BulkDialog.field.users.label()}
        description={LL.VIEW.GROUP.BulkDialog.field.users.description()}
        hintText={LL.VIEW.GROUP.BulkDialog.field.users.hintText()}
        errorText={errorText}
        stretch
        secondaryControl={
          <Inline>
            <Button
              onClick={closeHandler}
              label={LL.VIEW.GROUP.BulkDialog.ACTIONS.cancel.label()}
            >
              {LL.VIEW.GROUP.BulkDialog.ACTIONS.cancel.text()}
            </Button>
            <Button
              onClick={saveHandler}
              variant="primary"
              label={LL.VIEW.GROUP.BulkDialog.ACTIONS.save.label()}
            >
            {LL.VIEW.GROUP.BulkDialog.ACTIONS.save.text()}
            </Button>
          </Inline>
        }
      >
        <Textarea value={value} onChange={changeHandler} rows={20} />
      </FormField>
    </Modal>
  );
};
