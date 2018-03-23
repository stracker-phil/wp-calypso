/** @format */

/**
 * External dependencies
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { localize } from 'i18n-calypso';
import { connect } from 'react-redux';
import page from 'page';

/**
 * Internal dependencies
 */
import { recordTracksEvent } from 'state/analytics/actions';
import Card from 'components/card';
import HeaderCake from 'components/header-cake';
import Main from 'components/main';
import Button from 'components/button';

class NewAccount extends Component {
	static propTypes = {
		recordTracksEvent: PropTypes.func.isRequired,
		siteId: PropTypes.string.isRequired,
		translate: PropTypes.func.isRequired,
	};

	goBack = () => {
		page.back( `/google-my-business/${ this.props.siteId }` );
	};

	trackCreateMyListingClick = () => {
		this.props.recordTracksEvent(
			'calypso_google_my_business_empty_account_create_my_listing_button_click'
		);
	};

	trackNoThanksClick = () => {
		this.props.recordTracksEvent(
			'calypso_google_my_business_empty_account_no_thanks_button_click'
		);
	};

	render() {
		const { translate } = this.props;

		return (
			<Main className="google-my-business new-account" wideLayout>
				<HeaderCake isCompact={ false } alwaysShowActionText={ false } onClick={ this.goBack }>
					{ translate( 'Google My Business' ) }
				</HeaderCake>

				<Card className="new-account__card">
					<img
						alt={ translate( 'Local business illustration' ) }
						className="new-account__illustration"
						src="/calypso/images/google-my-business/business-local.svg"
					/>

					<h1>
						{ translate( 'It looks like you might be new to Google My Business' ) }
					</h1>

					<p>
						{ translate(
							'Google My Business lists your local business on Google Search and Google Maps. ' +
							'It works for businesses that have a physical location or serve a local area'
						) }
					</p>

					<div className="new-account__actions">
						<Button primary onClick={ this.trackCreateMyListingClick }>
							{ translate( 'Create My Listing' ) }
						</Button>

						<Button href={ `/stats/${ this.props.siteId }` } onClick={ this.trackNoThanksClick }>
							{ translate( 'No Thanks' ) }
						</Button>
					</div>
				</Card>
			</Main>
		);
	}
}

export default connect( undefined, { recordTracksEvent } )( localize( NewAccount ) );
