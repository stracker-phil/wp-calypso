/** @format */

/**
 * External dependencies
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Internal dependencies
 */
import constants from 'me/constants';

export default function FormVerificationCodeInput( { className, isError, isValid, method, ...otherProps } ) {
	const classes = classNames( 'form-verification-code-input', className, {
		'is-error': isError,
		'is-valid': isValid,
	} );

	let placeholder = constants.sixDigit2faPlaceholder;

	if ( method === 'backup' ) {
		placeholder = constants.eightDigitBackupCodePlaceholder;
	} else if ( method === 'sms' ) {
		placeholder = constants.sevenDigit2faPlaceholder;
	}

	return (
		<input
			autoComplete="off"
			className={ classes }
			pattern="[0-9 ]*"
			placeholder={ placeholder }
			type="tel"
			{ ...otherProps }
		/>
	);
}

FormVerificationCodeInput.propTypes = {
	className: PropTypes.string,
	isError: PropTypes.bool,
	isValid: PropTypes.bool,
	method: PropTypes.string,
};

FormVerificationCodeInput.defaultProps = {
	isError: false,
	isValid: false,
};
