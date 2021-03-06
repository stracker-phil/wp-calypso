/** @format */
/**
 * External Dependencies
 */
import PropTypes from 'prop-types';
import React from 'react';
import ReactDom from 'react-dom';
import { connect } from 'react-redux';
import { translate } from 'i18n-calypso';
import classNames from 'classnames';
import { get, startsWith } from 'lodash';

/**
 * Internal Dependencies
 */
import AutoDirection from 'components/auto-direction';
import ReaderMain from 'components/reader-main';
import EmbedContainer from 'components/embed-container';
import PostExcerpt from 'components/post-excerpt';
import { markPostSeen } from 'state/reader/posts/actions';
import ReaderFullPostHeader from './header';
import AuthorCompactProfile from 'blocks/author-compact-profile';
import LikeButton from 'reader/like-button';
import { isDiscoverPost, isDiscoverSitePick } from 'reader/discover/helper';
import DiscoverSiteAttribution from 'reader/discover/site-attribution';
import DailyPostButton from 'blocks/daily-post-button';
import { isDailyPostChallengeOrPrompt } from 'blocks/daily-post-button/helper';
import { shouldShowLikes } from 'reader/like-helper';
import { shouldShowComments } from 'blocks/comments/helper';
import CommentButton from 'blocks/comment-button';
import {
	recordAction,
	recordGaEvent,
	recordTrackForPost,
	recordPermalinkClick,
} from 'reader/stats';
import Comments from 'blocks/comments';
import scrollTo from 'lib/scroll-to';
import PostExcerptLink from 'reader/post-excerpt-link';
import { getSiteName } from 'reader/get-helpers';
import { keyForPost } from 'reader/post-key';
import KeyboardShortcuts from 'lib/keyboard-shortcuts';
import ReaderPostActions from 'blocks/reader-post-actions';
import { RelatedPostsFromSameSite, RelatedPostsFromOtherSites } from 'components/related-posts';
import { getStreamUrlFromPost } from 'reader/route';
import { likePost, unlikePost } from 'lib/like-store/actions';
import LikeStore from 'lib/like-store/like-store';
import FeaturedImage from 'blocks/reader-full-post/featured-image';
import { getFeed } from 'state/reader/feeds/selectors';
import { getSite } from 'state/reader/sites/selectors';
import QueryReaderSite from 'components/data/query-reader-site';
import QueryReaderFeed from 'components/data/query-reader-feed';
import QueryReaderPost from 'components/data/query-reader-post';
import ExternalLink from 'components/external-link';
import DocumentHead from 'components/data/document-head';
import ReaderFullPostUnavailable from './unavailable';
import BackButton from 'components/back-button';
import { isFeaturedImageInContent } from 'lib/post-normalizer/utils';
import ReaderFullPostContentPlaceholder from './placeholders/content';
import * as FeedStreamStoreActions from 'lib/feed-stream-store/actions';
import { getLastStore } from 'reader/controller-helper';
import { showSelectedPost } from 'reader/utils';
import Emojify from 'components/emojify';
import config from 'config';
import { COMMENTS_FILTER_ALL } from 'blocks/comments/comments-filters';
import { READER_FULL_POST } from 'reader/follow-sources';
import { getPostByKey } from 'state/reader/posts/selectors';

export class FullPostView extends React.Component {
	static propTypes = {
		post: PropTypes.object,
		onClose: PropTypes.func.isRequired,
		referralPost: PropTypes.object,
		referralStream: PropTypes.string,
	};

	hasScrolledToCommentAnchor = false;

	componentDidMount() {
		KeyboardShortcuts.on( 'close-full-post', this.handleBack );
		KeyboardShortcuts.on( 'like-selection', this.handleLike );
		KeyboardShortcuts.on( 'move-selection-down', this.goToNextPost );
		KeyboardShortcuts.on( 'move-selection-up', this.goToPreviousPost );

		// Send page view
		this.hasSentPageView = false;
		this.hasLoaded = false;
		this.attemptToSendPageView();

		this.checkForCommentAnchor();

		// If we have a comment anchor, scroll to comments
		if ( this.hasCommentAnchor && ! this.hasScrolledToCommentAnchor ) {
			this.scrollToComments();
		}
	}

	componentDidUpdate( prevProps ) {
		// Send page view if applicable
		if (
			get( prevProps, 'post.ID' ) !== get( this.props, 'post.ID' ) ||
			get( prevProps, 'feed.ID' ) !== get( this.props, 'feed.ID' ) ||
			get( prevProps, 'site.ID' ) !== get( this.props, 'site.ID' )
		) {
			this.hasSentPageView = false;
			this.hasLoaded = false;
			this.attemptToSendPageView();
		}

		this.checkForCommentAnchor();

		// If we have a comment anchor, scroll to comments
		if ( this.hasCommentAnchor && ! this.hasScrolledToCommentAnchor ) {
			this.scrollToComments();
		}
	}

	componentWillReceiveProps( newProps ) {
		if ( newProps.shouldShowComments ) {
			this.hasScrolledToCommentAnchor = false;
			this.checkForCommentAnchor();
		}
	}

	componentWillUnmount() {
		KeyboardShortcuts.off( 'close-full-post', this.handleBack );
		KeyboardShortcuts.off( 'like-selection', this.handleLike );
		KeyboardShortcuts.off( 'move-selection-down', this.goToNextPost );
		KeyboardShortcuts.off( 'move-selection-up', this.goToPreviousPost );
	}

	handleBack = event => {
		event.preventDefault();
		recordAction( 'full_post_close' );
		recordGaEvent( 'Closed Full Post Dialog' );
		recordTrackForPost( 'calypso_reader_article_closed', this.props.post );

		this.props.onClose && this.props.onClose();
	};

	handleCommentClick = () => {
		recordAction( 'click_comments' );
		recordGaEvent( 'Clicked Post Comment Button' );
		recordTrackForPost( 'calypso_reader_full_post_comments_button_clicked', this.props.post );
		this.scrollToComments();
	};

	handleLike = () => {
		const { site_ID: siteId, ID: postId } = this.props.post;
		let liked;

		if ( LikeStore.isPostLikedByCurrentUser( siteId, postId ) ) {
			unlikePost( siteId, postId );
			liked = false;
		} else {
			likePost( siteId, postId );
			liked = true;
		}

		recordAction( liked ? 'liked_post' : 'unliked_post' );
		recordGaEvent( liked ? 'Clicked Like Post' : 'Clicked Unlike Post' );
		recordTrackForPost(
			liked ? 'calypso_reader_article_liked' : 'calypso_reader_article_unliked',
			this.props.post,
			{ context: 'full-post', event_source: 'keyboard' }
		);
	};

	handleRelatedPostFromSameSiteClicked = () => {
		recordTrackForPost( 'calypso_reader_related_post_from_same_site_clicked', this.props.post );
	};

	handleVisitSiteClick = () => {
		recordPermalinkClick( 'full_post_visit_link', this.props.post );
	};

	handleRelatedPostFromOtherSiteClicked = () => {
		recordTrackForPost( 'calypso_reader_related_post_from_other_site_clicked', this.props.post );
	};

	// Does the URL contain the anchor #comments? If so, scroll to comments if we're not already there.
	checkForCommentAnchor = () => {
		const hash = window.location.hash.substr( 1 );
		if ( hash.indexOf( 'comments' ) > -1 ) {
			this.hasCommentAnchor = true;
		}
	};

	/**
	 * @returns {number} - the commentId in the url of the form #comment-${id}
	 */
	getCommentIdFromUrl = () =>
		startsWith( window.location.hash, '#comment-' )
			? +window.location.hash.split( '-' )[ 1 ]
			: undefined;

	// Scroll to the top of the comments section.
	scrollToComments = () => {
		if ( ! this.props.post ) {
			return;
		}
		if ( this.props.post._state ) {
			return;
		}
		if ( this._scrolling ) {
			return;
		}

		this._scrolling = true;
		setTimeout( () => {
			const commentsNode = ReactDom.findDOMNode( this.refs.commentsWrapper );
			if ( commentsNode && commentsNode.offsetTop ) {
				scrollTo( {
					x: 0,
					y: commentsNode.offsetTop - 48,
					duration: 300,
					onComplete: () => {
						// check to see if the comment node moved while we were scrolling
						// and scroll to the end position
						const commentsNodeAfterScroll = ReactDom.findDOMNode( this.refs.commentsWrapper );
						if ( commentsNodeAfterScroll && commentsNodeAfterScroll.offsetTop ) {
							window.scrollTo( 0, commentsNodeAfterScroll.offsetTop - 48 );
						}
						this._scrolling = false;
					},
				} );
				if ( this.hasCommentAnchor ) {
					this.hasScrolledToCommentAnchor = true;
				}
			}
		}, 0 );
	};

	attemptToSendPageView = () => {
		const { post, site } = this.props;

		if (
			post &&
			post._state !== 'pending' &&
			site &&
			site.ID &&
			! site.is_error &&
			! this.hasSentPageView
		) {
			this.props.markPostSeen( post, site );
			this.hasSentPageView = true;
		}

		if ( ! this.hasLoaded && post && post._state !== 'pending' ) {
			recordTrackForPost(
				'calypso_reader_article_opened',
				post,
				{},
				{
					pathnameOverride: this.props.referralStream,
				}
			);
			this.hasLoaded = true;
		}
	};

	goToNextPost = () => {
		const store = getLastStore();
		if ( store ) {
			if ( ! store.getSelectedPostKey() ) {
				store.selectItem( keyForPost( this.props.post ), store.id );
			}
			FeedStreamStoreActions.selectNextItem( store.getID() );
			showSelectedPost( { store, postKey: store.getSelectedPostKey() } );
		}
	};

	goToPreviousPost = () => {
		const store = getLastStore();
		if ( store ) {
			if ( ! store.getSelectedPostKey() ) {
				store.selectItem( keyForPost( this.props.post ), store.id );
			}
			FeedStreamStoreActions.selectPrevItem( store.getID() );
			showSelectedPost( { store, postKey: store.getSelectedPostKey() } );
		}
	};

	render() {
		const { post, site, feed, referralPost, referral, blogId, feedId, postId } = this.props;

		if ( post._state === 'error' ) {
			return <ReaderFullPostUnavailable post={ post } onBackClick={ this.handleBack } />;
		}

		const siteName = getSiteName( { site, post } );
		const classes = { 'reader-full-post': true };
		const showRelatedPosts = post && ! post.is_external && post.site_ID;
		const relatedPostsFromOtherSitesTitle = translate(
			'More on {{wpLink}}WordPress.com{{/wpLink}}',
			{
				components: {
					/* eslint-disable */
					wpLink: <a href="/" className="reader-related-card__link" />,
					/* eslint-enable */
				},
			}
		);

		if ( post.site_ID ) {
			classes[ 'blog-' + post.site_ID ] = true;
		}
		if ( post.feed_ID ) {
			classes[ 'feed-' + post.feed_ID ] = true;
		}

		const externalHref = isDiscoverPost( referralPost ) ? referralPost.URL : post.URL;
		const isLoading = ! post || post._state === 'pending' || post._state === 'minimal';
		const startingCommentId = this.getCommentIdFromUrl();
		const commentCount = get( post, 'discussion.comment_count' );
		const postKey = { blogId, feedId, postId };

		/*eslint-disable react/no-danger */
		/*eslint-disable react/jsx-no-target-blank */
		return (
			<ReaderMain className={ classNames( classes ) }>
				{ ! post || post._state === 'pending' ? (
					<DocumentHead title={ translate( 'Loading' ) } />
				) : (
					<DocumentHead title={ `${ post.title } ‹ ${ siteName } ‹ Reader` } />
				) }
				{ post && post.feed_ID && <QueryReaderFeed feedId={ +post.feed_ID } /> }
				{ post &&
					! post.is_external &&
					post.site_ID && <QueryReaderSite siteId={ +post.site_ID } /> }
				{ referral && ! referralPost && <QueryReaderPost postKey={ referral } /> }
				{ ! post || ( isLoading && <QueryReaderPost postKey={ postKey } /> ) }
				<BackButton onClick={ this.handleBack } />
				<div className="reader-full-post__visit-site-container">
					<ExternalLink
						icon={ true }
						href={ externalHref }
						onClick={ this.handleVisitSiteClick }
						target="_blank"
					>
						<span className="reader-full-post__visit-site-label">
							{ translate( 'Visit Site' ) }
						</span>
					</ExternalLink>
				</div>
				<div className="reader-full-post__content">
					<div className="reader-full-post__sidebar">
						{ isLoading && <AuthorCompactProfile author={ null } /> }
						{ ! isLoading &&
							post.author && (
								<AuthorCompactProfile
									author={ post.author }
									siteIcon={ get( site, 'icon.img' ) }
									feedIcon={ get( feed, 'image' ) }
									siteName={ siteName }
									siteUrl={ post.site_URL }
									feedUrl={ get( feed, 'feed_URL' ) }
									followCount={ site && site.subscribers_count }
									feedId={ +post.feed_ID }
									siteId={ +post.site_ID }
									post={ post }
								/>
							) }
						<div className="reader-full-post__sidebar-comment-like">
							{ shouldShowComments( post ) && (
								<CommentButton
									key="comment-button"
									commentCount={ commentCount }
									onClick={ this.handleCommentClick }
									tagName="div"
								/>
							) }
							{ shouldShowLikes( post ) && (
								<LikeButton
									siteId={ +post.site_ID }
									postId={ +post.ID }
									fullPost={ true }
									tagName="div"
								/>
							) }
						</div>
					</div>
					<Emojify>
						<article className="reader-full-post__story" ref="article">
							<ReaderFullPostHeader post={ post } referralPost={ referralPost } />

							{ post.featured_image &&
								! isFeaturedImageInContent( post ) && (
									<FeaturedImage src={ post.featured_image } />
								) }
							{ isLoading && <ReaderFullPostContentPlaceholder /> }
							{ post.use_excerpt ? (
								<PostExcerpt content={ post.better_excerpt ? post.better_excerpt : post.excerpt } />
							) : (
								<EmbedContainer>
									<AutoDirection>
										<div
											className="reader-full-post__story-content"
											dangerouslySetInnerHTML={ { __html: post.content } }
										/>
									</AutoDirection>
								</EmbedContainer>
							) }

							{ post.use_excerpt &&
								! isDiscoverPost( post ) && (
									<PostExcerptLink siteName={ siteName } postUrl={ post.URL } />
								) }
							{ isDiscoverSitePick( post ) && <DiscoverSiteAttribution post={ post } /> }
							{ isDailyPostChallengeOrPrompt( post ) && (
								<DailyPostButton post={ post } site={ site } />
							) }

							<ReaderPostActions
								post={ post }
								site={ site }
								onCommentClick={ this.handleCommentClick }
								fullPost={ true }
							/>

							{ showRelatedPosts && (
								<RelatedPostsFromSameSite
									siteId={ +post.site_ID }
									postId={ +post.ID }
									title={ translate( 'More in {{ siteLink /}}', {
										components: {
											siteLink: (
												<a
													href={ getStreamUrlFromPost( post ) }
													/* eslint-disable wpcalypso/jsx-classname-namespace */
													className="reader-related-card__link"
													/* eslint-enable wpcalypso/jsx-classname-namespace */
												>
													{ siteName }
												</a>
											),
										},
									} ) }
									/* eslint-disable wpcalypso/jsx-classname-namespace */
									className="is-same-site"
									/* eslint-enable wpcalypso/jsx-classname-namespace */
									onPostClick={ this.handleRelatedPostFromSameSiteClicked }
								/>
							) }

							<div className="reader-full-post__comments-wrapper" ref="commentsWrapper">
								{ shouldShowComments( post ) && (
									<Comments
										showNestingReplyArrow={ config.isEnabled( 'reader/nesting-arrow' ) }
										ref="commentsList"
										post={ post }
										initialSize={ startingCommentId ? commentCount : 10 }
										pageSize={ 25 }
										startingCommentId={ startingCommentId }
										commentCount={ commentCount }
										maxDepth={ 1 }
										commentsFilterDisplay={ COMMENTS_FILTER_ALL }
										showConversationFollowButton={ true }
										followSource={ READER_FULL_POST }
									/>
								) }
							</div>

							{ showRelatedPosts && (
								<RelatedPostsFromOtherSites
									siteId={ +post.site_ID }
									postId={ +post.ID }
									title={ relatedPostsFromOtherSitesTitle }
									/* eslint-disable wpcalypso/jsx-classname-namespace */
									className="is-other-site"
									/* eslint-enable wpcalypso/jsx-classname-namespace */
									onPostClick={ this.handleRelatedPostFromOtherSiteClicked }
								/>
							) }
						</article>
					</Emojify>
				</div>
			</ReaderMain>
		);
	}
}

export default connect(
	( state, ownProps ) => {
		const { feedId, blogId, postId } = ownProps;
		const post = getPostByKey( state, { feedId, blogId, postId } ) || { _state: 'pending' };

		const { site_ID: siteId, is_external: isExternal } = post;

		const props = { post };

		if ( ! isExternal && siteId ) {
			props.site = getSite( state, siteId );
		}
		if ( feedId ) {
			props.feed = getFeed( state, feedId );
		}
		if ( ownProps.referral ) {
			props.referralPost = getPostByKey( state, ownProps.referral );
		}

		return props;
	},
	{ markPostSeen }
)( FullPostView );
