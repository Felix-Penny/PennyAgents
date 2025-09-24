// Object ACL (Access Control List) for Security Agent File Management
// Based on javascript_object_storage integration blueprint with security-specific enhancements
import { File } from "@google-cloud/storage";
import { storage } from "./storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// The type of the access group for security system.
export enum ObjectAccessGroupType {
  USER_LIST = "USER_LIST",
  STORE_SECURITY_STAFF = "STORE_SECURITY_STAFF", 
  SECURITY_AGENT_ROLE = "SECURITY_AGENT_ROLE",
  ORGANIZATION_MEMBERS = "ORGANIZATION_MEMBERS",
  INVESTIGATION_TEAM = "INVESTIGATION_TEAM"
}

// The logic user group that can access the object.
export interface ObjectAccessGroup {
  // The type of the access group.
  type: ObjectAccessGroupType;
  // The logic id that is enough to identify the qualified group members.
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// The ACL policy of the object.
// This would be set as part of the object custom metadata:
// - key: "custom:aclPolicy"
// - value: JSON string of the ObjectAclPolicy object.
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

// Check if the requested permission is allowed based on the granted permission.
function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  // Users granted with read or write permissions can read the object.
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }

  // Only users granted with write permissions can write the object.
  return granted === ObjectPermission.WRITE;
}

// The base class for all access groups.
abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  // Check if the user is a member of the group.
  public abstract hasMember(userId: string): Promise<boolean>;
}

// Store security staff access group implementation
class StoreSecurityStaffAccessGroup extends BaseObjectAccessGroup {
  constructor(storeId: string) {
    super(ObjectAccessGroupType.STORE_SECURITY_STAFF, storeId);
  }

  async hasMember(userId: string): Promise<boolean> {
    try {
      // Check if user has security agent access for this store
      const user = await storage.getUser(userId);
      if (!user) return false;

      // Check if user is assigned to this store and has security agent permissions
      if (user.storeId === this.id) {
        // Check if user has security agent role via user-agent-access table
        const userAgentAccess = await storage.getUserAgentsByUser(userId);
        return userAgentAccess.some(access => 
          access.agentId === "security" && 
          access.isActive &&
          ["viewer", "operator", "admin"].includes(access.role)
        );
      }
      
      return false;
    } catch (error) {
      console.error("Error checking store security staff membership:", error);
      return false;
    }
  }
}

// Organization members access group implementation  
class OrganizationMembersAccessGroup extends BaseObjectAccessGroup {
  constructor(organizationId: string) {
    super(ObjectAccessGroupType.ORGANIZATION_MEMBERS, organizationId);
  }

  async hasMember(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      return user?.organizationId === this.id && user?.isActive === true;
    } catch (error) {
      console.error("Error checking organization membership:", error);
      return false;
    }
  }
}

// Security agent role access group implementation
class SecurityAgentRoleAccessGroup extends BaseObjectAccessGroup {
  constructor(role: string) {
    super(ObjectAccessGroupType.SECURITY_AGENT_ROLE, role);
  }

  async hasMember(userId: string): Promise<boolean> {
    try {
      const userAgentAccess = await storage.getUserAgentsByUser(userId);
      return userAgentAccess.some(access => 
        access.agentId === "security" && 
        access.role === this.id &&
        access.isActive
      );
    } catch (error) {
      console.error("Error checking security agent role membership:", error);
      return false;
    }
  }
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    case ObjectAccessGroupType.STORE_SECURITY_STAFF:
      return new StoreSecurityStaffAccessGroup(group.id);
    case ObjectAccessGroupType.ORGANIZATION_MEMBERS:
      return new OrganizationMembersAccessGroup(group.id);
    case ObjectAccessGroupType.SECURITY_AGENT_ROLE:
      return new SecurityAgentRoleAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// Sets the ACL policy to the object metadata.
export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

// Gets the ACL policy from the object metadata.
export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

// Checks if the user can access the object.
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  // When this function is called, the acl policy is required.
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  // Public objects are always accessible for read.
  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  // Access control requires the user id.
  if (!userId) {
    return false;
  }

  // The owner of the object can always access it.
  if (aclPolicy.owner === userId) {
    return true;
  }

  // Go through the ACL rules to check if the user has the required permission.
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}