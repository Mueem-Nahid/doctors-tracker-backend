export type AdminIdentity = {
  _id: string;
  email: string;
  name: string;
  role: "admin";
};

export type LoginRequest = {
  body: {
    email: string;
    password: string;
  };
};

export type AuthenticatedSession = {
  token: string;
  user: AdminIdentity;
};
