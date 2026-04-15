jQuery(document).ready(function ($) {

    function extcf7_signature() {
        const forms = $(".wpcf7-form");

        forms.each(function (form_index, form) {
            const fileInput = $(form).find('.extcf7_signature_field_input');
            fileInput.css('display', 'none');

            $(form).find(".extcf7_signature_pad").each(function (pad_index, pad) {
                const canvas = $(pad).find('canvas').get(0);
                const inputField = $(pad).closest('.wpcf7-form-control-wrap').find('.extcf7_signature_field_input');
                const inputName = inputField.attr('name');
                
                const pad_bg_color = canvas.dataset?.bgColor;
                const pen_color = canvas.dataset?.penColor;
                
                const signature = new SignaturePad(canvas, {
                    includeBackgroundColor: true,
                    backgroundColor: pad_bg_color,
                    penColor: pen_color,
                });

                signature.addEventListener('endStroke', function () {
                    if (!signature.isEmpty()) {
                        // Convert signature to PNG image
                        const dataURL = signature.toDataURL('image/png');
                        
                        // Convert data URL to Blob
                        const blobBin = atob(dataURL.split(',')[1]);
                        const array = [];
                        for(let i = 0; i < blobBin.length; i++) {
                            array.push(blobBin.charCodeAt(i));
                        }
                        const blob = new Blob([new Uint8Array(array)], {type: 'image/png'});
                        
                        // Create a File object from the Blob
                        const filename = 'signature.png';
                        const file = new File([blob], filename, {type: 'image/png'});
                        
                        // Create a FileList-like object
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        
                        // Set the file to the input field
                        inputField[0].files = dataTransfer.files;
                    }
                });

                $(pad).find('.extcf7_signature_clear_button').on('click', function () {
                    signature.clear();
                    
                    // Clear the file input when signature is cleared
                    const dataTransfer = new DataTransfer();
                    inputField[0].files = dataTransfer.files;
                });
            });
        });
    }

    extcf7_signature();
    
    // Re-initialize signature pads when CF7 reloads the form
    $(document).on('wpcf7:spam wpcf7:invalid wpcf7:mailsent wpcf7:mailfailed', function() {
        setTimeout(extcf7_signature, 100);
    });
});