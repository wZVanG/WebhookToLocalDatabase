async function hmac(secret: string, message: string): Promise<string> {
	const textEncoder = new TextEncoder();

	const encodedSecret = textEncoder.encode(secret);
	const encodedMessage = textEncoder.encode(message);

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		encodedSecret,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);

	const signature = await crypto.subtle.sign('HMAC', cryptoKey, encodedMessage);

	// Convert ArrayBuffer to base64
	return bufferToBase64(signature);
}

export default async function validateWebhookSignature(secret: string, body: string, signature: string): Promise<boolean> {
	const signatureComputed = await hmac(secret, body);

	return signatureComputed === signature;
}

// Función auxiliar para convertir ArrayBuffer a cadena base64
function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
