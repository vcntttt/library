export function hasReadingIntegrationAccess(
	isAuthenticated: boolean,
	isIntegrationOwner: boolean | undefined,
) {
	return isAuthenticated && isIntegrationOwner === true;
}
