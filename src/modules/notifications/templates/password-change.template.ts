export const passwordChangeMessage = (date: Date) => {
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(date);

    return {
        subject: 'Password Changed',
        text: `Your password was changed on ${formattedDate}.`,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2c3e50;">Password Changed</h2>
            <p>Your password was changed on:</p>
            <p style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block; font-weight: bold;">
                ${formattedDate}
            </p>
            <p>If you did not perform this action, please contact support immediately.</p>
        </div>
        `,
    };
};