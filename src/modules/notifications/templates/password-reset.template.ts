export const resetPasswordMessage = (resetPasswordUrl: string, token: string, expiresAt: Date, requestDate: Date) => {
    const formatOptions: Intl.DateTimeFormatOptions = {
        dateStyle: 'long',
        timeStyle: 'short',
    };
    
    const formattedDate = new Intl.DateTimeFormat('en-US', formatOptions).format(requestDate);
    const formattedExpires = new Intl.DateTimeFormat('en-US', formatOptions).format(expiresAt);

    return {
        subject: 'Reset Your Password',
        text: `Reset your password by clicking this link: ${resetPasswordUrl}. Requested on ${formattedDate}. Expires on ${formattedExpires}.`,
        html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px;">
            <h2 style="color: #111827;">Reset Your Password</h2>
            <p>You requested a password reset on <strong>${formattedDate}</strong>.</p>
            <p>Click the button below to set a new password for your account:</p>
            
            <div style="margin: 30px 0;">
                <a href="${resetPasswordUrl}" 
                   style="display:inline-block; padding:12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    Reset Password
                </a>
                <p style="font-size: 0.85em; color: #ef4444; margin-top: 10px;">
                    <strong>Note:</strong> This link will expire on ${formattedExpires}.
                </p>
            </div>

            <p style="font-size: 0.9em; color: #4b5563;">If you did not request this, you can safely ignore this email.</p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; background-color: #f9fafb; padding: 10px; border-radius: 4px;">
                <strong>Debug Info (Testing only):</strong><br>
                Token: <code>${token}</code>
            </p>
        </div>
        `,
    };
};