import React, { Component } from 'react';
import PropTypes from 'prop-types';
import uuidv4 from 'uuid/v4';
import FormContext from './FormContext';
import { callAll } from '../../utils/helpers/functionHelpers';
import memoize from 'memoize-one';

const controllerType = {
    input: 'input',
    textarea: 'textarea',
    select: 'select',
    radioGroup: 'radioGroup',
    checkbox: 'checkbox',
    checkboxGroup: 'checkboxGroup'
};

const defaultValues = {
    input: '',
    textarea: '',
    select: '',
    radioGroup: '',
    checkbox: false,
    checkboxGroup: []
};

/**
 * @component
 * Controller components for tenon-ui smart controls.
 *
 * Exports a controlling functions for each of the controls in the tenon-ui toolkit.
 *
 * @prop required {function} children - The standard React children have been overridden to
 * accept render functions. This render function gets called with an object containing
 * getter functions from the smart input controller as well as as the current error text
 * and a display flag for the error container.
 *
 * @example
 * This is an example for the TextInputController call.
 * {
 *      getLabelProps: function,
 *      getInputProps: function,
 *      getErrorProps: function,
 *      getContentHintProps: function,
 *      showError: boolean,
 *      errorText: string
 * }
 *
 * @prop required {function} registerControl: Registers a control with the
 *                  smart form.
 * @prop required {function} deregisterControl: Deregisters a control with
 *                  the smart form.
 * @prop required {function} setControlValue: Sets the given control's value
 *                  to the smart form state.
 * @prop required {function} getControlValue: Gets the given control's value
 *                  from the smart form state;
 * @prop required {function} setControlValidity: Sets the given control's
 *                  validation validity to the smart form state.
 * @prop required {function} getControlValidity: Gets the given control's
 *                  validation validity from the smart form state.
 * @prop required {function} getControlErrorText: Gets the given control's
 *                  current errorMessage, if any, from the smart form state.
 * @prop {array} validators: An array of composed validators using the
 *                  validator helper function.
 * @prop required {string} name: The unique name of the control.
 */
class FormController extends Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        component: PropTypes.any,
        deregisterControl: PropTypes.func.isRequired,
        registerControl: PropTypes.func.isRequired,
        setControlValue: PropTypes.func.isRequired,
        getControlValue: PropTypes.func.isRequired,
        setControlValidity: PropTypes.func.isRequired,
        getControlValidity: PropTypes.func.isRequired,
        getControlErrorText: PropTypes.func.isRequired,
        validators: PropTypes.arrayOf(PropTypes.object),
        name: PropTypes.string.isRequired,
        required: PropTypes.oneOfType([
            PropTypes.bool,
            PropTypes.oneOf(['true', 'false'])
        ]),
        registerErrors: PropTypes.bool
    };

    static displayName = 'FormController';

    /**
     * @constructor
     * Initializes the internal component ID's
     *
     * @param props
     */
    constructor(props) {
        super(props);

        this.controlId = uuidv4();
        this.contentHintId = uuidv4();
        this.errorId = uuidv4();

        this.state = {
            contentHintId: ''
        };

        this.contentHintRegistered = false;
    }

    /**
     * @function
     * Registers the control with smart form when the component
     * is successfully mounted.
     *
     * Runs an initial validation to check required validation
     * states.
     *
     * The control is registered with a unique generated ID,
     * the given name and the current validation state. The
     * ID is that of the focusable element, and therefore the
     * ID if the container is supplied in the case of a
     * radiogroup.
     */
    componentDidMount() {
        const {
            registerControl,
            getControlValue,
            setControlValidity,
            name,
            formControllerType
        } = this.props;
        registerControl(
            name,
            this.controlId,
            defaultValues[formControllerType],
            true,
            ''
        );
        setControlValidity(name, this.runValidation(getControlValue(name)));
    }

    /**
     * @function
     * Reruns the control validation on every change.
     *
     * Sets the content hint ID. This is required here because
     * the presence of a content hint is detected when a call
     * to the content hint prop getter is issued. This then needs
     * to permeate to the input prop getter as well to set an
     * aria-describedby link.
     */
    componentDidUpdate() {
        const {
            getControlValue,
            setControlValidity,
            getControlValidity,
            getControlErrorText,
            name
        } = this.props;

        const validationResult = this.runValidation(getControlValue(name));
        if (
            validationResult.validity !== getControlValidity(name) ||
            validationResult.errorText !== getControlErrorText(name)
        ) {
            setControlValidity(name, this.runValidation(getControlValue(name)));
        }

        //This is required to update the component when a content hint is
        //detected so that the id linkage is established in the prop
        //getter functions.
        if (this.contentHintRegistered && !this.state.contentHintId) {
            this.setState({
                contentHintId: this.contentHintId
            });
        }
    }

    /**
     * @function
     * Deregisters the control from the smart form when the
     * component is unmounted.
     */
    componentWillUnmount() {
        const { deregisterControl, name } = this.props;
        deregisterControl(name);
    }

    /**
     * @function
     * Event handler for the onchange event of the connected
     * <input>
     *
     * Sets the current value in the smart form state.
     *
     * @param {SyntheticKeyboardEvent} e
     */
    onChangeHandler = e => {
        const { setControlValue, name, formControllerType } = this.props;
        setControlValue(
            name,
            formControllerType === controllerType.checkbox
                ? e.target.checked
                : e.target.value
        );
    };

    /**
     * @function
     * Event handler for the onchange event of the connected
     * <input type="checkbox">
     *
     * Sets the current value in the smart form state.
     *
     * This event is only used for checkboxes in a checkbox
     * group.
     *
     * @param {SyntheticKeyboardEvent} e
     */
    onGroupCheckboxChangeHandler = e => {
        const { getControlValue, setControlValue, name } = this.props;
        // The value is first stripped to ensure any double
        //invocations of the handler is idempotent.
        const strippedValue = getControlValue(name).filter(
            value => value !== e.target.name
        );
        setControlValue(
            name,
            e.target.checked ? [...strippedValue, e.target.name] : strippedValue
        );
    };

    /**
     * @function
     * Prop getter for the <label>.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * If an autoIdPostfix config property is provided, this
     * will be appended to the automatically generated Id. This
     * is required for radio button collections.
     *
     * @param {object} props
     * @returns {object}
     */
    getLabelProps = ({ autoIdPostfix, ...props } = {}) => ({
        htmlFor: `${this.controlId}${autoIdPostfix ? `-${autoIdPostfix}` : ''}`,
        ...props
    });

    /**
     * Calculates the aria-describedby property of the <input> tag.
     *
     * @param {boolean} isValid
     * @returns {string | null}
     */
    getAriaDescribedBy = isValid => {
        const { contentHintId } = this.state;

        let describedByIds = [];

        if (contentHintId) {
            describedByIds.push(contentHintId);
        }

        if (!isValid) {
            describedByIds.push(this.errorId);
        }

        return describedByIds.join(' ') || null;
    };

    /**
     * @function
     * Returns the duplicated input control props used in both
     * a text input as well as a checkbox input.
     *
     * @param required {object} props - Object with the given
     * props to configure the input.
     * @param {SyntheticEvent} onChange - Custome user onChange
     * event handler.
     *
     * @returns {object}
     */
    getBaseInputProps = (props, onChange) => {
        const {
            name,
            getControlValidity,
            registerErrors,
            required
        } = this.props;
        const isValid = registerErrors ? getControlValidity(name) : true;

        return {
            'aria-describedby': this.getAriaDescribedBy(isValid),
            'aria-disabled': props['disabled'] ? 'true' : null,
            'aria-invalid': isValid ? null : 'true',
            'aria-required':
                required === true || required === 'true' ? 'true' : null,
            id: this.controlId,
            name,
            onChange: callAll(onChange, this.onChangeHandler)
        };
    };

    /**
     * @function
     * Prop getter for the <input>.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getInputProps = ({ onChange, ...props } = {}) => {
        const { name, getControlValue } = this.props;

        return {
            ...this.getBaseInputProps(props, onChange),
            'aria-readonly': props['readOnly'] ? 'true' : null,
            type: 'text',
            value: getControlValue(name),
            ...props
        };
    };

    /**
     * @function
     * Prop getter for the <textarea>.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getTextareaProps = (props = {}) => {
        const { type, ...rest } = this.getInputProps(props);
        return rest;
    };

    /**
     * @function
     * Prop getter for the <select>.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * Direct re-export of the getInputProps function as a
     * <select> takes the same props as an <input>. This
     * is done to make the usage more declarative.
     *
     * @param {object} props
     * @returns {object}
     */
    getSelectProps = (props = {}) => {
        const { type, ...rest } = this.getInputProps(props);
        return rest;
    };

    /**
     * @function
     * Prop getter for the <input type="checkbox">.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getCheckboxProps = ({ onChange, ...props } = {}) => {
        const { name, getControlValue } = this.props;

        return {
            ...this.getBaseInputProps(props, onChange),
            type: 'checkbox',
            checked: getControlValue(name),
            ...props
        };
    };

    /**
     * @function
     * Prop getter for the <input type="checkbox"> when used
     * inside a checkbox group. As the checkbox group now
     * manages the combined data as one entry in the smart
     * form, these differ from a checkbox used by itself.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getGroupCheckboxProps = ({ onChange, name, focusElement, ...props }) => {
        const { getControlValue, name: controllerName } = this.props;
        return {
            'aria-disabled': props['disabled'] ? 'true' : null,
            name,
            id: focusElement ? this.controlId : `${this.controlId}-${name}`,
            type: 'checkbox',
            onChange: callAll(onChange, this.onGroupCheckboxChangeHandler),
            checked: getControlValue(controllerName).indexOf(name) !== -1,
            ...props
        };
    };

    /**
     * @function
     * Prop getter for every <input> of a group of radio buttons.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * Requires a value config property as this is used to
     * set the value of the radio button as well as determine
     * if the radio button is checked.
     *
     * @param {object} props
     * @returns {object}
     */
    getRadioButtonProps = ({ value, onChange, focusElement, ...props }) => {
        const { name, getControlValue } = this.props;

        return {
            'aria-disabled': props['disabled'] ? 'true' : null,
            name,
            id: focusElement ? this.controlId : `${this.controlId}-${value}`,
            type: 'radio',
            onChange: callAll(onChange, this.onChangeHandler),
            value,
            checked: getControlValue(name) === value,
            ...props
        };
    };

    /**
     * @function
     * Prop getter for the error container.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getErrorProps = (props = {}) => ({
        id: this.errorId,
        ...props
    });

    /**
     * @function
     * Prop getter for the content hint container.
     *
     * Composes the given prop configuration object with the
     * standard control props object.
     *
     * @param {object} props
     * @returns {object}
     */
    getContentHintProps = (props = {}) => {
        this.contentHintRegistered = true;

        return {
            id: this.state.contentHintId,
            ...props
        };
    };

    /**
     * @function
     * Runs the validator functions as composed with the validator
     * validation helper function.
     *
     * Calculates the first failing validation in the array
     * in order and applies that error message.
     *
     * If all validations pass the error text is empty and the
     * control is marked as valid.
     *
     * @param {string} textValue
     * @returns {*|{validity: boolean, errorText: string}}
     */
    runValidation = textValue => {
        const { validators = [] } = this.props;
        return validators.reduce(
            (prev, cur) => {
                if (prev.errorText || cur.ignore) {
                    return prev;
                }
                const validateResult = cur.func(textValue);
                return !validateResult
                    ? { validity: validateResult, errorText: cur.message }
                    : prev;
            },
            { validity: true, errorText: '' }
        );
    };

    /**
     * @function
     * Return the render props object per formControllerType.
     */
    getTypeSpecificRenderProps = formControllerType => {
        const commonRenderProps = {
            getLabelProps: this.getLabelProps,
            getErrorProps: this.getErrorProps,
            getContentHintProps: this.getContentHintProps
        };

        switch (formControllerType) {
            case controllerType.textarea:
                return {
                    getTextareaProps: this.getTextareaProps,
                    ...commonRenderProps
                };
            case controllerType.select:
                return {
                    getSelectProps: this.getSelectProps,
                    ...commonRenderProps
                };
            case controllerType.checkbox:
                return {
                    getCheckboxProps: this.getCheckboxProps,
                    ...commonRenderProps
                };
            case controllerType.checkboxGroup:
                return {
                    getLabelProps: this.getLabelProps,
                    getCheckboxProps: this.getGroupCheckboxProps
                };
            case controllerType.radioGroup:
                return {
                    getLabelProps: this.getLabelProps,
                    getRadioButtonProps: this.getRadioButtonProps
                };
            case controllerType.input:
            default:
                return {
                    getInputProps: this.getInputProps,
                    ...commonRenderProps
                };
        }
    };

    /**
     * @function
     * Composes the object to send to the render function for each
     * controller type.
     *
     * Memoized so as to only recalculate if the type changes.
     */
    buildRenderObject = memoize(formControllerType =>
        this.getTypeSpecificRenderProps(formControllerType)
    );

    render() {
        const {
            children,
            formControllerType,
            getControlValidity,
            getControlErrorText,
            name,
            required,
            registerErrors,
            component,
            deregisterControl,
            registerControl,
            setControlValue,
            getControlValue,
            setControlValidity,
            validators,
            ...rest
        } = this.props;

        const renderProps = {
            showError: registerErrors ? !getControlValidity(name) : false,
            errorText: getControlErrorText(name),
            required: required === true || required === 'true',
            ...this.buildRenderObject(formControllerType)
        };

        return component
            ? React.createElement(
                  component,
                  { ...renderProps, ...rest },
                  children
              )
            : children && children(renderProps);
    }
}

/**
 * @function
 * Function to return the controller based on formControllerType. Fetches the
 * React Context exposed functionality from the smart form
 * containing the Context provider and expose it as props
 * to the controllers.
 *
 * @props props
 */
const getController = (props, formControllerType) => (
    <FormContext.Consumer>
        {contextProps => (
            <FormController
                {...props}
                {...contextProps}
                formControllerType={formControllerType}
            >
                {props.children}
            </FormController>
        )}
    </FormContext.Consumer>
);

const controllerPropTypes = {
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    component: PropTypes.any,
    validators: PropTypes.arrayOf(PropTypes.object),
    name: PropTypes.string.isRequired,
    required: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.oneOf(['true', 'false'])
    ])
};

/**
 * @component
 * Text input controller
 *
 * @prop {function} children - Render function for the
 * text input view.
 * @prop {React Node} component - Component for the
 * text input view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const TextInputController = props =>
    getController(props, controllerType.input);
TextInputController.propTypes = controllerPropTypes;

/**
 * @component
 * Textarea controller
 *
 * @prop {function} children - Render function for the
 * textarea view.
 * @prop {React Node} component - Component for the
 * textarea view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const TextareaController = props =>
    getController(props, controllerType.textarea);
TextareaController.propTypes = controllerPropTypes;

/**
 * @component
 * Select controller
 *
 * @prop {function} children - Render function for the
 * select view.
 * @prop {React Node} component - Component for the
 * select view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const SelectController = props =>
    getController(props, controllerType.select);
SelectController.propTypes = controllerPropTypes;

/**
 * @component
 * Radiogroup controller
 *
 * @prop {function} children - Render function for the
 * radiogroup view.
 * @prop {React Node} component - Component for the
 * radiogroup view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const RadioGroupController = props =>
    getController(props, controllerType.radioGroup);
RadioGroupController.propTypes = controllerPropTypes;

/**
 * @component
 * Single checkbox controller
 *
 * @prop {function} children - Render function for the
 * checkbox view.
 * @prop {React Node} component - Component for the
 * checkbox view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const CheckboxController = props =>
    getController(props, controllerType.checkbox);
CheckboxController.propTypes = controllerPropTypes;

/**
 * @component
 * Checkbox group controller
 *
 * @prop {function} children - Render function for the
 * checkbox group view.
 * @prop {React Node} component - Component for the
 * checkbox group view.
 * @prop required {string} name - The name to register the control
 * with, with the smartform.
 * @validators {array} validators - Array of validator functions to
 * run
 */
export const CheckboxGroupController = props =>
    getController(props, controllerType.checkboxGroup);
CheckboxGroupController.propTypes = controllerPropTypes;
