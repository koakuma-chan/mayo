// dprint-ignore
import { 
  ActionError,

  defineAction
}             from "astro:actions";

// dprint-ignore
import { z }  from "astro:schema";

// dprint-ignore
import { 
  Id,

  Password,

  Username
}             from "@/types/incoming";

// dprint-ignore
import type { 
  Invite,

  User 
}             from "@/types/database";

export const authentication = {
  sign_in: defineAction({
    accept: "form",

    input: z.object({
      username: Username,

      password: Password,
    }),

    handler: async (
      //
      input,
      //
      request,
    ) => {
      const {
        database,

        secret,
      } = request.locals.context;

      const {
        username,

        password,
      } = input;

      const user = database
        //
        .query(`
          select 
            id, 

            password_hash 

          from users 

          where name = ?1
        `)
        //
        .get(username) as Pick<User, "id" | "password_hash"> | null;

      if (user === null) {
        // dprint-ignore
        throw new ActionError({
          code    : "PRECONDITION_FAILED",

          message : "Invalid username or password.",
        });
      }

      const is_verified = await Bun.password.verify(password, user.password_hash);

      if (!is_verified) {
        // dprint-ignore
        throw new ActionError({
          code    : "PRECONDITION_FAILED",

          message : "Invalid username or password.",
        });
      }

      return sign(user.id, secret);
    },
  }),

  sign_up: defineAction({
    accept: "form",

    input: z.object(
      // dprint-ignore
      {
        invite_id : Id,

        username  : Username,

        password  : Password,
      },
    ),

    handler: async (
      //
      input,
      //
      request,
    ) => {
      const {
        database,

        secret,
      } = request.locals.context;

      const {
        invite_id,

        username,

        password,
      } = input;

      // dprint-ignore
      const user_id       = Bun.randomUUIDv7(),

            password_hash = await Bun.password.hash(password);

      database.transaction(() => {
        const invite = database
          //
          .query(`
            select 
              uses 

            from invites 

            where id = ?1
          `)
          //
          .get(invite_id) as Pick<Invite, "uses"> | null;

        if (invite === null) {
          // dprint-ignore
          throw new ActionError({
            code    : "PRECONDITION_FAILED",

            message : "The specified invitation does not exist.",
          });
        }

        try {
          database
            //
            .query(`
              insert into users

              (
                id,

                name,

                password_hash
              ) 

              values 

              (
                ?1,

                ?2,

                ?3
              );
            `)
            //
            .run(
              //
              user_id,
              //
              username,
              //
              password_hash,
            );
        } catch (e: any) {
          if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
            // dprint-ignore
            throw new ActionError({
              code    : "PRECONDITION_FAILED",

              message : "The specified username is already taken.",
            });
          }

          throw e;
        }

        if (invite.uses) {
          const remaining_uses = invite.uses - 1;

          if (remaining_uses < 1) {
            database
              //
              .query(`
                delete from invites 

                where id = ?1;
              `)
              //
              .run(invite_id);
          } else {
            database
              //
              .query(`
                update invites 

                set uses = ?1 

                where id = ?2;
              `)
              //
              .run(
                //
                remaining_uses,
                //
                invite_id,
              );
          }
        }
      })();

      return sign(user_id, secret);
    },
  }),
};

const sign = (
  // dprint-ignore
  user_id : User["id"],
  // dprint-ignore
  secret  : string,
) => {
  const hasher = new Bun.CryptoHasher("blake2b512", secret);

  hasher.update(user_id);

  const signature = hasher.digest("hex");

  return JSON.stringify({
    user_id,

    signature,
  });
};
