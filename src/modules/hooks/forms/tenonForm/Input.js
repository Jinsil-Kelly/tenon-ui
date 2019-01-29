import React, { forwardRef } from 'react';
import FeedbackBlock from '../../../forms/tenonForm/FeedbackBlock';
import { useInput } from './formHooks';
import classNames from 'classnames';

const Input = forwardRef(
    (
        {
            labelText,
            labelProps,
            name,
            required,
            requiredText,
            className,
            contentHintText,
            validators,
            ...rest
        },
        ref
    ) => {
        const {
            getLabelProps,
            getInputProps,
            getErrorProps,
            getContentHintProps,
            showError,
            errorText
        } = useInput(name, validators);

        return (
            <div className="form-group">
                <div className="field-wrapper">
                    <label {...getLabelProps(labelProps)}>
                        {labelText}
                        {required ? (
                            <span aria-hidden="true" className="required">
                                &nbsp;
                                {requiredText || '*'}
                            </span>
                        ) : null}
                    </label>
                    <input
                        {...getInputProps(rest)}
                        ref={ref}
                        className={
                            classNames(className, { 'has-error': showError }) ||
                            null
                        }
                    />
                </div>
                <FeedbackBlock
                    getContentHintProps={getContentHintProps}
                    getErrorProps={getErrorProps}
                    errorText={errorText}
                    contentHintText={contentHintText}
                    showError={showError}
                />
            </div>
        );
    }
);

export default Input;
