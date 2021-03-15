import type { Opaque } from 'type-fest';

import type { DocumentId } from './document.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Page, PageParams, PODModel } from './model.js';
import { makePage, ResourceId } from './model.js';

export type JobId = Opaque<ResourceId, 'JobId'>;

/**
 * Input document for a compute job.
 */
export declare type InputDocumentSpec = {
  /** ID of the document to mount. */
  id: DocumentId;
  /** Path where the input document will be mounted inside the job. Interpreted relative to `/parcel/data/in`. */
  mountPath: string;
};

/**
 * Specification for a compute job for outputting a document.
 */
export declare type OutputDocumentSpec = {
  /** Path to the file that should be uploaded as an output document. Interpreted relative to `/parcel/data/out`. */
  mountPath: string;
  /** Owner to assign to the output document. */
  owner?: IdentityId;
};

/**
 * An output document produced in the context of running a job.
 */
export declare type OutputDocument = {
  mountPath: string;
  id: DocumentId;
};

/**
 * A specification/manifest for the job. This is a complete description of what
 * and how the job should run.
 */
export type JobSpec = {
  /**
   * A human-readable name for the job. Intended to help with monitoring and
   * debugging. The name SHOULD be unique among jobs submitted by the same
   * user. */
  name: string;

  /**
   * The command-line arguments to the command that should be run to start the
   * job. This corresponds to `CMD` in Docker terminology; note that images
   * running on Parcel are required to have a non-empty `ENTRYPOINT`, so the
   * actual command that runs will be the
   * [concatenation](https://docs.docker.com/engine/reference/builder/#understand-how-cmd-and-entrypoint-interact)
   * of `ENTRYPOINT` and this field.
   */
  cmd: string[];

  /**
   * The name of the docker image to use, optionally prefixed with an image
   * repository hostname. See [docker
   * pull](https://docs.docker.com/engine/reference/commandline/pull/)
   * documentation for a full description of allowable formats.
   */
  image: string;

  /**
   * Environment variables to use when running the image. Setting `PATH` is
   * not allowed.
   */
  env?: Record<string, string>;

  /**
   * Documents to download and mount into the job's container before `cmd` runs.
   * If any of these documents do not exist or you do not have permission to access them, the job will fail.
   */
  inputDocuments?: InputDocumentSpec[];

  /**
   * Files to be uploaded from the job's container as documents after `cmd` runs.
   * Files that do not exist will be silently skipped; the job will not fail.
   */
  outputDocuments?: OutputDocumentSpec[];
};

export type JobStatus = {
  phase: JobPhase;

  /**
   * A human readable message indicating details about why the pod is in this
   * condition.
   */
  message?: string;

  /**
   * Documents that were generated by the job and uploaded by the Parcel
   * Worker. For a pending or running job, this list will be empty. For a
   * successfully completed job, each `outputDocument` entry from the job spec will
   * have a corresponding entry in this list.
   */
  outputDocuments: OutputDocument[];

  /**
   * A reference to the worker hosting (running) this job, if any. This field
   * is intended for human reference/debugging only for now, so no semantics
   * are prescribed for the endpoint at the `host` address.
   */
  host?: string;
};

export enum JobPhase {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCEEDED = 'Succeeded',
  FAILED = 'Failed',
}

export type PODJob = Readonly<
  PODModel & {
    id: JobId;
    spec: JobSpec;

    /**
     * Most recently observed status of the pod. This data may not be up to
     * date. The data type is a mostly subset of [Kubernetes'
     * PodStatus](https://www.k8sref.io/docs/workloads/pod-v1/#podstatus).
     */
    status: JobStatus;
  }
>;

/**
 * An existing, already-submitted job. The job might also be already completed.
 */
export class Job {
  public readonly id: JobId;
  public readonly createdAt: Date;
  public readonly spec: JobSpec;
  public readonly status: JobStatus;

  public constructor(private readonly client: HttpClient, pod: PODJob) {
    this.id = pod.id;
    this.createdAt = new Date(pod.createdAt);
    this.spec = pod.spec;
    this.status = pod.status;
  }
}

const COMPUTE_EP = 'compute';
const JOBS_EP = `${COMPUTE_EP}/jobs`;
const endpointForId = (id: JobId) => `${JOBS_EP}/${id}`;

export namespace ComputeImpl {
  export async function submitJob(client: HttpClient, spec: JobSpec): Promise<Job> {
    const pod = await client.post<PODJob>(JOBS_EP, spec);
    return new Job(client, pod);
  }

  export async function listJobs(client: HttpClient, filter: PageParams = {}): Promise<Page<Job>> {
    const podPage = await client.get<Page<PODJob>>(JOBS_EP, filter);
    return makePage(Job, podPage, client);
  }

  export async function getJob(client: HttpClient, jobId: JobId): Promise<Job> {
    const pod = await client.get<PODJob>(endpointForId(jobId));
    return new Job(client, pod);
  }

  export async function terminateJob(client: HttpClient, jobId: JobId): Promise<void> {
    return client.delete(endpointForId(jobId));
  }
}
