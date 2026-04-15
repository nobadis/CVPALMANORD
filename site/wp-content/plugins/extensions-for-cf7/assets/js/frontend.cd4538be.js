'use strict';

document.addEventListener( 'wpcf7statuschanged', function( event ) {
    const form = event.target,
        button = form.querySelector('.wpcf7-submit');
    if(event?.detail?.status === 'submitting') {
        button.setAttribute('disabled', 'disabled');
    }
    if(event?.detail?.status !== 'submitting') {
        button.removeAttribute('disabled');
    }
}, false );