/** @format */
/**
 * External dependencies
 */
import React from 'react';
import { connect } from 'react-redux';
import { localize } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import Banner from 'components/banner';
import { getSiteAdminUrl } from 'state/sites/selectors';
import { getSelectedSiteSlug } from 'state/ui/selectors';
import { getRewindState } from 'state/selectors';

export const UnavailabilityNotice = ( {
	adminUrl,
	reason,
	rewindState,
	slug,
	translate,
	siteId,
} ) => {
	if ( rewindState !== 'unavailable' ) {
		return null;
	}

	switch ( reason ) {
		case 'missing_plan':
			return (
				<Banner
					plan="personal-bundle"
					href={ `/plans/${ slug }` }
					callToAction={ translate( 'Upgrade' ) }
					title={ translate(
						'Upgrade your Jetpack plan to restore your site to events in the past.'
					) }
				/>
			);
		case 'no_connected_jetpack':
			return (
				<Banner
					icon="history"
					href={ adminUrl }
					title={ translate( 'The site is not connected.' ) }
					description={ translate(
						"We can't back up or rewind your site until it has been reconnected."
					) }
				/>
			);

		case 'vp_can_transfer':
			return (
				<Banner
					icon="history"
					href={ `/start/rewind-switch/?siteId=${ siteId }&siteSlug=${ slug }` }
					title={ translate( 'Try our new backup service' ) }
					description={ translate(
						'Get real-time backups with one-click restores to any event in time.'
					) }
				/>
			);

		default:
			return null;
	}
};

const mapStateToProps = ( state, { siteId } ) => {
	const { reason, state: rewindState } = getRewindState( state, siteId );

	return {
		adminUrl: getSiteAdminUrl( state, siteId ),
		reason,
		rewindState,
		slug: getSelectedSiteSlug( state ),
		siteId,
	};
};

export default connect( mapStateToProps )( localize( UnavailabilityNotice ) );
