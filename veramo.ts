import { createAgent, IDIDManager, IKeyManager, TAgent } from "@veramo/core"
import { AgentRestClient } from '@veramo/remote-client'

export type VeramoAgent = TAgent<IDIDManager & IKeyManager>

// TODO: add apiKey support
export const getAgent = ({ url, apiKey }: { url: string, apiKey: string }): VeramoAgent => {
	return createAgent<IDIDManager & IKeyManager>({
		plugins: [
			new AgentRestClient({
				url,
				enabledMethods: ['resolveDid', 'didManagerGet', 'didManagerFind', 'keyManagerSign']
			})
		]
	})
}
