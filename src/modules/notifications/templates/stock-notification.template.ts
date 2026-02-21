export const stockNotificationMessage = (
  productName: string,
  productImage: string,
) => ({
  subject: `Only a few left! ${productName} is back in stock!`,
  html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hi there,</p>
            <p>You recently liked <strong>${productName}</strong>. Good news: There are only 3 items left in stock!</p>
            ${productImage ? `<img src="${productImage}" alt="${productName}" style="max-width: 300px; display: block; margin: 20px 0; border-radius: 8px;" />` : ''}
            <p>Don't miss out, grab it before it's gone.</p>
            <p>Best regards,<br/>The Store Team</p>
        </div>
    `,
});
