/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { makeStyles } from '@material-ui/core/styles';
import ArrowDropDown from '@material-ui/icons/ArrowDropDown';
import Box from 'aws-northstar/layouts/Box';
import Button from 'aws-northstar/components/Button';
import Menu, { MenuProps } from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import React, {
  EventHandler,
  FunctionComponent,
  MouseEventHandler,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useEffect,
} from 'react';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';

export interface ButtonDropdownItem {
  key?: React.Key;
  /**
   * The text to display for the item.
   * */
  text?: ReactNode;
  /**
   * Disables the drop down item, not allowing it to be clicked.
   * */
  disabled?: boolean;
  /**
   * You can supply an Item array to display nested under a parent Item heading. Only two levels of item nesting can be provided.
   * */
  items?: ButtonDropdownItem[];
  /**
   * Fired when the user clicks on drop down item. If nested Item arrays are provided, the parent onClick handler will be treated as a heading and ignored.
   * */
  onClick?: EventHandler<any>;

  variant?: 'normal' | 'primary';
}

export interface ButtonDropdownProps {
  /**
   * The content to be displayed in the button.
   * */
  content: ReactNode;
  /**
   * Determines the general styling of the underlying button. Only primary and normal variants are supported.
   * */
  variant?: 'normal' | 'primary';
  /**
   * Renders the button as being in a loading state.
   * */
  loading?: boolean;
  /**
   * Renders the button as disabled and prevents clicks.
   * */
  disabled?: boolean;
  /**
   * Array of content to be displayed in the Button drawer.
   * */
  items?: ButtonDropdownItem[];
  /**
   * Disables the default dropdown arrow icon
   * */
  disableArrowDropdown?: boolean;
  /**
   * The className of the menu item to override the styling of menu item.
   */
  menuItemClassName?: string;
  /**
   * Indicating whether the button will be displayed on the dark theme (e.g., header bar)
   * */
  darkTheme?: boolean;
  /**
   * Fired when the user clicks on the drop down button.
   * */
  onClick?: MouseEventHandler<HTMLElement>;

  innerMenuProps?: Partial<Omit<MenuProps, 'open'>>;

  /** Indicates if memu is closed on selection */
  disableCloseOnSelection?: boolean;
}

const useStyles = makeStyles((theme) => ({
  menuItem: {
    padding: '5px 20px',
  },
  menuItemPrimary: {
    // color: theme.palette.primary.main,
    color: '#de740c',
  },
  subHeading: {
    padding: '5px 20px',
    fontSize: '14px',
    fontWeight: 700,
    color: theme.palette.grey[600],
  },
  disabledSubHeading: {
    opacity: '0.5',
    cursor: 'default',
  },
  childMenuItem: {
    paddingLeft: '24px',
    '&:first-of-type': {
      borderTop: `1px solid ${theme.palette.grey[200]}`,
    },
    '&:last-of-type': {
      borderBottom: `1px solid ${theme.palette.grey[200]}`,
    },
  },
  darkTheme: {
    '& .MuiButton-root': {
      border: 'none',
      padding: '4px 5px',
      color: 'currentColor',
      '&:hover': {
        color: 'currentColor',
      },
    },
  },
}));

/**
 * A button dropdown is used to group a set of actions under one button.
 */
export const ButtonDropdown: FunctionComponent<ButtonDropdownProps> = ({
  content,
  items = [],
  variant = 'normal',
  loading,
  disabled,
  disableArrowDropdown = false,
  menuItemClassName,
  darkTheme,
  onClick,
  disableCloseOnSelection,
  innerMenuProps,
}) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event);
      if (items.length > 0) {
        setAnchorEl(event.currentTarget);
      }
    },
    [onClick, items, setAnchorEl],
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, [setAnchorEl]);

  const handleMenuItemClick = useCallback(
    (item: ButtonDropdownItem) => {
      return (e: SyntheticEvent) => {
        item.onClick?.(e);

        if (!disableCloseOnSelection && !(e.isDefaultPrevented() || e.isPropagationStopped())) {
          handleClose();
        }
      };
    },
    [handleClose, disableCloseOnSelection],
  );

  useEffect(() => {
    if (items.length === 0 && anchorEl != null) {
      handleClose();
    }
  }, [items, anchorEl, handleClose]);

  const renderMenuItem = useCallback(
    (item: ButtonDropdownItem, index) => (
      <MenuItem
        key={item.key || index}
        className={clsx(menuItemClassName, classes.menuItem, item.variant === 'primary' ? classes.menuItemPrimary : {})}
        onClick={handleMenuItemClick(item)}
        disabled={item.disabled}
        dense
      >
        {item.text}
      </MenuItem>
    ),
    [menuItemClassName, handleMenuItemClick, classes.menuItem],
  );

  const renderMenuItemWithHeading = useCallback(
    (item: ButtonDropdownItem, index) => {
      return (
        <Box key={index}>
          <Typography
            className={clsx(classes.subHeading, { [classes.disabledSubHeading]: item.disabled })}
            variant="subtitle1"
          >
            {item.text}
          </Typography>

          {item.items?.map((itemChild: ButtonDropdownItem, _index) => (
            <MenuItem
              key={item.key || _index}
              className={clsx(
                menuItemClassName,
                classes.menuItem,
                classes.childMenuItem,
                itemChild.variant === 'primary' ? classes.menuItemPrimary : {},
              )}
              onClick={itemChild.onClick}
              disabled={item.disabled || itemChild.disabled}
              dense
            >
              {itemChild.text}
            </MenuItem>
          ))}
        </Box>
      );
    },
    [classes, menuItemClassName],
  );

  return (
    <Box className={clsx({ [classes.darkTheme]: darkTheme })}>
      <Button
        variant={variant}
        onClick={handleClick}
        loading={loading}
        disabled={disabled}
        aria-haspopup="true"
        aria-controls="simple-menu"
      >
        {content} {!disableArrowDropdown && <ArrowDropDown fontSize="small" />}
      </Button>

      <Menu
        anchorEl={anchorEl}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        elevation={2}
        transitionDuration={0}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        {...innerMenuProps}
      >
        {items.map((item: ButtonDropdownItem, index) =>
          item.items ? renderMenuItemWithHeading(item, index) : renderMenuItem(item, index),
        )}
      </Menu>
    </Box>
  );
};

export default ButtonDropdown;
