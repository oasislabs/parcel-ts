import type { Opaque } from 'type-fest';

import type { ConsentId } from './consent';
import type { Constraints } from './filter';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, PODModel, ResourceId } from './model';

export type GrantId = Opaque<ResourceId>;

export type PODGrant = PODModel & {
    granter: ResourceId;
    grantee?: ResourceId;
    consent?: ResourceId;
    filter?: Constraints;
};

export type GrantCreateParams = {
    /**
     * The singular Identity to which permission is given, or everyone;
     */
    grantee: IdentityId | 'everyone';

    /** A filter that gives permission to only matching Datasets. */
    filter?: Constraints;
};

export interface Grant extends Model {
    /** The time at which this grant was made. */
    createdAt: Date;

    /** The Identity from which permission is given. */
    granter: IdentityId;

    /**
     * The Identity to which permission is given. `null` represents everybody.
     */
    grantee: IdentityId | null;

    /** The Consent that created this Grant, if any. */
    consent?: ConsentId;

    /**
     * Revokes the Grant.
     * @throws `ParcelError`
     */
    delete: () => Promise<void>;
}

const GRANTS_EP = '/grants';

export class GrantImpl implements Grant {
    public id: GrantId;
    public createdAt: Date;
    public granter: IdentityId;
    public grantee: IdentityId | null;
    public filter?: Constraints;
    public consent?: ConsentId;

    private constructor(private readonly client: HttpClient, pod: PODGrant) {
        this.id = pod.id as GrantId;
        this.createdAt = new Date(pod.createdAt);
        this.granter = pod.granter as IdentityId;
        this.grantee = (pod.grantee as IdentityId) ?? 'everyone';
        this.filter = pod.filter;
        this.consent = pod.consent as ConsentId;
    }

    public static async create(client: HttpClient, parameters: GrantCreateParams): Promise<Grant> {
        return client
            .create<PODGrant>(GRANTS_EP, parameters)
            .then((podGrant) => new GrantImpl(client, podGrant));
    }

    public static async get(client: HttpClient, id: GrantId): Promise<Grant> {
        return client
            .get<PODGrant>(GrantImpl.endpointForId(id))
            .then((podGrant) => new GrantImpl(client, podGrant));
    }

    public static async delete(client: HttpClient, id: GrantId): Promise<void> {
        return client.delete(GrantImpl.endpointForId(id));
    }

    private static endpointForId(id: GrantId): string {
        return `${GRANTS_EP}/${id}`;
    }

    public async delete(): Promise<void> {
        return this.client.delete(GrantImpl.endpointForId(this.id));
    }
}
